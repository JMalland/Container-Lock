ll.registerPlugin("Crop Protect", "Make crops easier to farm, and prevent accidential destruction.", [1,0,0], {"Author": "JTM"})
const http = require('http')
var config = null
log("Started CropProtect.js Plugin");
http.get("https://raw.githubusercontent.com/JMalland/LiteLoaderBDS-Plugins/main/Crop%20Protect/crops_config.json", (response) => {
    config = new JsonConfigFile("plugins/LLCropProtect/config.json", response)
    log("Loaded CropProtect config.json")
})

//var config = new JsonConfigFile("plugins/LLCropProtect/config.json")

// Make it so redstone can be used to harvest crops?

// Have right-click harvest configuration per item used

// Grab config.JSON from github

crops = {
    wheat: {
        enabled: true,
        name: "wheat",
        origin: "wheat",
        replant: true,
        growth: 7,
        harvest: [
            { x: 0, y: 0, z: 0, }, // Center
            { x: 1, y: 0, z: 0, },  //
            { x: 0, y: 0, z: 1, },  //
            { x: -1, y: 0, z: 0, }, //
            { x: 0, y: 0, z: -1, }, //
        ]
    },
    carrots: {
        enabled: true,
        name: "carrots",
        origin: "carrots",
        replant: true,
        growth: 7,
        harvest: [
            { x: 0, y: 0, z: 0, }, // Center
        ]
    },
    potatoes: {
        enabled: true,
        name: "potatoes",
        origin: "potatoes",
        replant: true,
        growth: 7,
        harvest: [
            { x: 0, y: 0, z: 0, }, // Center
        ]
    },
    beetroot: {
        enabled: true,
        name: "beetroot",
        origin: "beetroot",
        replant: true,
        growth: 7,
        harvest: [
            { x: 0, y: 0, z: 0, }, // Center
        ]
    },
    pumpkin: {
        enabled: true,
        name: "pumpkin",
        origin: "pumpkin_stem",
        replant: false,
        growth: 7,
        harvest: [
            { x: 1, y: 0, z: 0, },  //
            { x: 0, y: 0, z: 1, },  //
            { x: -1, y: 0, z: 0, }, //
            { x: 0, y: 0, z: -1, }, //
        ]
    },
    melon_block: {
        enabled: true,
        name: "melon_block",
        origin: "melon_stem",
        replant: false,
        growth: 7,
        harvest: [
            { x: 1, y: 0, z: 0, },  //
            { x: 0, y: 0, z: 1, },  //
            { x: -1, y: 0, z: 0, }, //
            { x: 0, y: 0, z: -1, }, //
        ]
    },
    cocoa: {
        enabled: true,
        name: "cocoa",
        origin: "cocoa",
        replant: true,
        growth: 2,
        harvest: [
            { x: 0, y: 0, z: 0, }, // Center
        ]
    },
    cactus: {
        enabled: true,
        name: "cactus",
        origin: "cactus",
        replant: false,
        growth: null,
        harvest: [
            { x: 0, y: 1, z: 0, }, // Up
        ]
    },
    sugar_cane: {
        enabled: true,
        name: "reeds",
        origin: "reeds",
        replant: false,
        growth: null,
        harvest: [
            { x: 0, y: 1, z: 0, }, // Up
        ]
    },
    bamboo: {
        enabled: true,
        name: "bamboo",
        origin: "bamboo",
        replant: false,
        growth: null,
        harvest: [
            { x: 0, y: 1, z: 0, }, // Up
        ]
    },
    kelp: {
        enabled: true,
        name: "kelp",
        origin: "kelp",
        replant: false,
        growth: null,
        harvest: [
            { x: 0, y: 1, z: 0, }, // Up
        ]
    },
    chorus_plant: {
        enabled: true,
        name: "chorus_plant",
        origin: "chorus_plant",
        replant: false,
        growth: null,
        harvest: [
            { x: 0, y: 1, z: 0, },  // Up
            { x: 1, y: 0, z: 0, },  // 
            { x: 0, y: 0, z: 1, },  // 
            { x: -1, y: 0, z: 0, }, //
            { x: 0, y: 0, z: -1, }, //
        ]
    }
}

items = {
    list: [],
    onlyAllowUsingItems: false,
}

log(JSON.stringify(config))

crops = config.get("crops") // Store the crop objects

crops["pumpkin_stem"] = crops["pumpkin"] // Point 'pumpkin_stem' to the 'pumpkin' object
crops["melon_stem"] = crops["melon_block"] // Point 'melon_stem' to the 'melon_block' object
crops["reeds"] = crops["sugar_cane"] // Point 'reeds' to the 'sugar_cane' object

function includes(list, pos) {
    for (let item of list) {
        if (item.x == pos.x && item.y == pos.y && item.z == pos.z && item.dimid == pos.dimid) {
            return(true);
        }
    }
    return(false);
}

function breakCrop(crop, block) {
    let state = block.getBlockState() // Store the block state
    if ((state.growth != null && crop.growth > state.growth) || (state.age != null && crop.growth > state.age)) { // Crop isn't fully grown
        return(false) // Did not break the crop
    }
    block.destroy(true) // Break the crop
    if (!crop.replant) { // Should not replant
        return(true) // Did break the crop
    }
    object = {} // Create blank object
    for (var property in state) { // Create the new NBT state for the replanted block
        if (Object.prototype.hasOwnProperty.call(state, property)) { // Is a valid field within the block state 
            if (property == "age" || property == "growth") {
                object[property] = new NbtInt(0) // Reset age/growth
            }
            else { // Should determine value type
                object[property] = new NbtInt(state[property]) // Keep default setting
            }
        }
    }
    block.setNbt(new NbtCompound({ // Update the NBT tag of the destroyed block
        "name": new NbtString(block.name),
        "states": new NbtCompound(object),
        "version": block.getNbt().getTag("version"),
    }))
    return(true) // Did break the crop
}

function useItemOn(player, item, block) { // Player right clicked a block
    let crop = crops[block.name.substring(10)] // Store the crop info
    let state = block.getBlockState() // Store the block state
    if (crop == null) { // The block doesn't exist within the crops definition
        return // Quit the function
    }
    else if (!crop.enabled) { // Auto harvest is disabled for this crop
        return // Quit the function
    }
    else if ((items.list.includes(item.name) && !items.onlyAllowUsingItems) || (!items.list.includes(item.name) && items.onlyAllowUsingItems)) { // User didn't use a valid item
        log(player.name + ", you can't auto-harvest using '" + item.name + "'!")
        return // Quit the function
    }
    else if ((state.growth != null && crop.growth > state.growth) || (state.age != null && crop.growth > state.age)) { // Crop isn't fully grown
        return // Quit the function
    }
    let origins = [block.pos] // Store all connected blocks
    let targets = [] // Store all target blocks
    let count = 0 // Count all harvested blocks
    for (let i=0; i<origins.length; i++) { // Go through each position in the list
        for (let relPos of crop.harvest) { // Check each position, relative to crop (NESW to the crop)
            let target_block = mc.getBlock(origins[i].x + relPos.x, origins[i].y + relPos.y, origins[i].z + relPos.z, origins[i].dimid) // Store the target block
            if (includes(targets, target_block.pos)) { // The block was harvested, or didn't need to be
                continue // Skip this block
            }
            else { // The block has yet to be harvested and/or checked
                if (target_block.name == "minecraft:" + crop.name) { // Found connected target
                    targets.push(target_block.pos) // Add to list of checked targets
                    if (breakCrop(crop, target_block)) { // Harvested the crop
                        count ++ // Increase the counter
                    }
                }
                if (target_block.name == "minecraft:" + crop.origin && !includes(origins, target_block.pos)) { // Found connected origin block
                    origins.push(target_block.pos) // Add to list of connected blocks to be checked
                }
            }
        }
    }
    if (count > 0) { // Crops were harvested
        log("Harvested " + count + " of '" + crop.name + "' connected to '" + crop.origin + "'.");
    }
}

mc.listen("onUseItemOn", useItemOn) // Listen for players to right click a block
