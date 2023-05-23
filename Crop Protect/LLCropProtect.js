ll.registerPlugin("Crop Protect", "Make crops easier to farm, and prevent accidential destruction.", [1,0,0], {"Author": "JTM"})
var crops = {}
var items = {}

initializeConfigs() // Create the initial config Objects
log("Loaded CropProtect configuration files")
initializeListeners() // Create the event listeners to run the plugin
log("Loaded CropProtect event listeners")

log("Crops:")
log(crops)
log("Items:")
log(items)

// Make it so redstone can be used to harvest crops?

// Have right-click harvest configuration per item used

function includes(list, pos) {
    for (let item of list) {
        if (item.x == pos.x && item.y == pos.y && item.z == pos.z && item.dimid == pos.dimid) {
            return(true);
        }
    }
    return(false);
}

function breakCrop(crop, block) {
    let nbt = block.getNbt() // Store the block Nbt
    let state = block.getBlockState() // Store the block state as an Object
    let nbtstate = nbt.getTag("states") // Store the block state as an NbtCompound
    if ((nbtstate.getTag("growth") != null && crop.growth > nbtstate.getTag("growth")) || (nbtstate.getTag("age") != null && crop.growth > nbtstate.getTag("age"))) { // Crop isn't fully grown
        return(false) // Did not break the crop
    }
    block.destroy(true) // Break the crop
    if (!crop.replant) { // Should not replant
        return(true) // Did break the crop
    }
    if (nbtstate.getKeys().includes("age")) nbtstate.setTag("age", new NbtInt(0)) // Reset the block's age
    if (nbtstate.getKeys().includes("growth")) nbtstate.setTag("growth", new NbtInt(0)) // Reset the block's growth
    nbt.setTag("states", nbtstate) // Update the 'states' tag of the Nbt (means the Nbt is an NbtCompound)
    block.setNbt(nbt) // Update the block's Nbt
    return(true) // Did break the crop
}

function useItemOn(player, tool, block) { // Player right clicked a block
    let crop = crops.get(block.name.substring(10)) // Store the crop info
    let item = items.get(block.name.substring(10)) // Store the item usage info
    let nbtstate = block.getNbt().getTag("states") // Store the block state
    if (crop == null) { // The block doesn't exist within the crops definition
        return // Quit the function
    }
    else if (!crop.enabled) { // Auto harvest is disabled for this crop
        log("Using incorrect item")
        return // Quit the function
    }
    else if ((!item.canUseItems.includes(tool.name) && !item.canUseItems.length == 0) || (item.unusableItems.includes(tool.name)) || (item.canHarvestUsingSelf == false && tool.name.substring(10) == crop.name)) { // User didn't use a valid item
        log(player.name + ", you can't auto-harvest using '" + item.name + "'!")
        return // Quit the function
    }
    else if ((nbtstate.getTag("growth") != null && crop.growth > nbtstate.getTag("growth")) || (nbtstate.getTag("age") != null && crop.growth > nbtstate.getTag("age"))) { // Crop isn't fully grown
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
                    } }
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

function initializeConfigs() {
    let CROP_CONFIG = {
        "wheat": {
            "enabled": true,
            "name": "wheat",
            "origin": "wheat",
            "replant": true,
            "growth": 7,
            "harvest": [{ "x": 0, "y": 0, "z": 0}, { "x": 1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 1 }, { "x": -1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": -1 } ]
        },
        "carrots": {
            "enabled": true,
            "name": "carrots",
            "origin": "carrots",
            "replant": true,
            "growth": 7,
            "harvest": [ { "x": 0, "y": 0, "z": 0 } ]
        },
        "potatoes": {
            "enabled": true,
            "name": "potatoes",
            "origin": "potatoes",
            "replant": true,
            "growth": 7,
            "harvest": [ { "x": 0, "y": 0, "z": 0 } ]
        },
        "beetroot": {
            "enabled": true,
            "name": "beetroot",
            "origin": "beetroot",
            "replant": true,
            "growth": 7,
            "harvest": [ { "x": 0, "y": 0, "z": 0 } ]
        },
        "pumpkin": {
            "enabled": true,
            "name": "pumpkin",
            "origin": "pumpkin_stem",
            "replant": false,
            "growth": 7,
            "harvest": [ { "x": 1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 1 }, { "x": -1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": -1 } ]
        },
        "melon_block": {
            "enabled": true,
            "name": "melon_block",
            "origin": "melon_stem",
            "replant": false,
            "growth": 7,
            "harvest": [ { "x": 1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 1 }, { "x": -1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": -1 } ]
        },
        "cocoa": {
            "enabled": true,
            "name": "cocoa",
            "origin": "cocoa",
            "replant": true,
            "growth": 2,
            "harvest": [ { "x": 0, "y": 0, "z": 0 } ]
        },
        "cactus": {
            "enabled": true,
            "name": "cactus",
            "origin": "cactus",
            "replant": false,
            "growth": null,
            "harvest": [ { "x": 0, "y": 1, "z": 0 } ]
        },
        "sugar_cane": {
            "enabled": true,
            "name": "reeds",
            "origin": "reeds",
            "replant": false,
            "growth": null,
            "harvest": [ { "x": 0, "y": 1, "z": 0 } ]
        },
        "bamboo": {
            "enabled": true,
            "name": "bamboo",
            "origin": "bamboo",
            "replant": false,
            "growth": null,
            "harvest": [ { "x": 0, "y": 1, "z": 0 } ]
        },
        "kelp": {
            "enabled": true,
            "name": "kelp",
            "origin": "kelp",
            "replant": false,
            "growth": null,
            "harvest": [ { "x": 0, "y": 1, "z": 0 } ]
        },
        "chorus_plant": {
            "enabled": true,
            "name": "chorus_plant",
            "origin": "chorus_plant",
            "replant": false,
            "growth": null,
            "harvest": [ { "x": 0, "y": 1, "z": 0 }, { "x": 1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 1 }, { "x": -1, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": -1 } ]
        }
    }
    CROP_CONFIG["pumpkin_stem"] = CROP_CONFIG["pumpkin"] // Point 'pumpkin_stem' to the 'pumpkin' object
    CROP_CONFIG["melon_stem"] = CROP_CONFIG["melon_block"] // Point 'melon_stem' to the 'melon_block' object
    CROP_CONFIG["reeds"] = CROP_CONFIG["sugar_cane"] // Point 'reeds' to the 'sugar_cane' object
    let ITEM_CONFIG = {} // Store crop settings per each item
    for (var property in CROP_CONFIG) { // Go through each crop in the config
        if (Object.prototype.hasOwnProperty.call(CROP_CONFIG, property)) { // Is a valid crop
            ITEM_CONFIG[property] = { // Set the crop item settings
                canUseItems: [], // Items that can harvest with
                unusableItems: [], // Items that can't harvest with
                canHarvestUsingSelf: false // Crops can't be harvested while holding the same crop
            }
        }
    }
    crops = new JsonConfigFile("plugins/LLCropProtect/crops.json", JSON.stringify(CROP_CONFIG)) // Import the crops configuration
    items = new JsonConfigFile("plugins/LLCropProtect/items.json", JSON.stringify(ITEM_CONFIG)) // Import the items configuration
}

function initializeListeners() {
    mc.listen("onUseItemOn", useItemOn) // Listen for players to right click a block
}