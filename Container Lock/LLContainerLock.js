ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [2,3,6], {"Author": "JTM"})

var storage = {}
var config = {}

initializeConfigs()

compass = { // Calculate the position in a given direction
    "2": (pos) => { return(new IntPos(pos.x, pos.y, pos.z - 1, pos.dimid)) }, // North
    "3": (pos) => { return(new IntPos(pos.x, pos.y, pos.z + 1, pos.dimid)) }, // South
    "4": (pos) => { return(new IntPos(pos.x - 1, pos.y, pos.z, pos.dimid)) }, // East
    "5": (pos) => { return(new IntPos(pos.x + 1, pos.y, pos.z, pos.dimid)) } // West
}

// Should reimplement getting lock signs and stuff
function getLockPieces(block) {
    let facing = block.getBlockState().facing_direction
    let chest_one = block.hasContainer() ? block : mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Get the first locked chest
    let chest_entity = chest_one.getBlockEntity().getNbt() // Store the entity NBT tag of the first chest
    let object = {} // Store the values in an object. Easier than using '.length%i'
    object.chests = [chest_one, chest_entity.getTag("pairx") == null ? null : mc.getBlock(parseInt(chest_entity.getTag("pairx")), chest_one.pos.y, parseInt(chest_entity.getTag("pairz")), chest_one.pos.dimid)] // Store the chests in an array
    if (object.chests[1] == null && compass[chest_one.getBlockState().facing_direction] == null) { // No large chest, and container has no 'facing' direction
        object.signs = [] // Empty list to store signs
        for (let i=2; i<=5; i++) { // Go through each cardinal direction
            let sign = mc.getBlock(compass[i](chest_one.pos)) // Store the potential sign block
            if (compass[sign.getBlockState().facing_direction] == null || sign.getBlockState().facing_direction != i) { // The sign isn't facing the proper direction (isn't apart of this lock)
                sign = null // Erase the sign from the list
            }
            object.signs.push(sign) // Add the N/S/E/W block relative to the container
        }
    }
    else { // The lock is using a container with a 'front' side (chest, trapped chest, barrel, etc)
        object.signs = [mc.getBlock(compass[facing](chest_one.pos)), object.chests[1] != null ? mc.getBlock(compass[facing](object.chests[1].pos)) : null] // Store the signs in an array
    }
    for (let i=0; i<object.signs.length; i++) { // Go through each sign
        if (object.signs[i] != null) { // Block exists --> Signs end up null if not lock, or sign
            if (storage.get(object.signs[i].pos.toString()) == null || (object.signs.length == 2 && object.signs[i].getBlockState().facing_direction != facing)) { // Block isn't apart of a lock, or this lock
                object.signs[i] = null // Erase the block from the list, since irrelevant
            }
            else if (!object.signs[i].name.includes("wall_sign")) { // Block is not a sign, but should be
                resetSign(object.signs[i], true) // Replace the text on the sign
            }
        }
    }
    return(object) // Return an object containing signs/chests
}

// Return the list of players with access
function getAccessList(lock) {
    let access_list = [] // Store who has access to the lock
    for (let sign of lock.signs) { // Go through each sign
        if (sign == null) { // Not apart of the lock
            continue // Keep going
        }
        for (let player of storage.get(sign.pos.toString()).list) { // Add the players with access
            access_list.push(player)
        }
    }
    access_list.sort() // Sort the array (just for string comparison)
    return(access_list) // Return the array
}

function breakLock(signs) { 
    for (let sign of signs) { // Go through each sign
        if (sign == null || storage.get(sign.pos.toString()) == null) { // Not apart of the lock
            continue // Keep going
        }
        storage.delete(sign.pos.toString()) // Remove the lock from storage
        storage.reload() // Reload the configuration after it's edited
        sign.destroy(false) // Destroy the sign
        mc.spawnItem(mc.newItem(sign.name.substring(0, sign.name.indexOf("wall_sign")) + "sign", 1), sign.pos) // Summon a dropped sign
        log("Removed Lock!")
    }
}

// Place each block in the list in place of whatever's at that position, keeping the same NBT tags
function resetBlocks(blocks) {
    for (let block of blocks) {
        if (block == null) { // Block doesn't exist 
            continue // Keep going
        }
        mc.setBlock(block.pos, block.name, 0) // Replace whatever's at the position with the proper block
        let new_block = mc.getBlock(block.pos) // Update the block
        new_block.setNbt(block.getNbt()) // Update the block NBT (and the facing_direction)
        if (block.hasBlockEntity() && new_block.hasBlockEntity()) { // Can update the block entity
            log("Updated Block Entity")
            new_block.getBlockEntity().setNbt(block.getBlockEntity().getNbt()) // Update the block entity NBT
        }
    }
    log("Reset " + blocks.length + " blocks.")
}

// Update the text of the sign at that position, replacing the sign again if necessary
function resetSign(sign, force) {
    let expected = "[Lock]" // Initial line of the sign's text
    if (storage.get(sign.pos.toString()) == null || sign.getBlockEntity() == null) { // The block isn't a lock, or has no text
        return // Quit the function
    }
    else if (!sign.name.includes("wall_sign")) { // Block isn't apart of a lock, but should be
        mc.setBlock(sign.pos, storage.get(sign.pos.toString()).sign, 0) // Replace the block
        let nbt = mc.getBlock(sign.pos).getNbt() // Store the NBT
        nbt.getTag("states").setTag("facing_direction", new NbtInt(object.signs.length > 2 ? i + 2 : facing)) // Update the direction
        mc.getBlock(sign.pos).setNbt(nbt) // Update the NBT
        let sign = mc.getBlock(sign.pos) // Update the sign block
        force = true // Make sure the text gets updated      
        log("Replaced lock sign!")
    }
    for (let line of storage.get(sign.pos.toString()).list) { // Go through each player with access
        expected += "\n" + line // Add each line
    }
    let entity = sign.getBlockEntity().getNbt() // Store the entity NBT
    if (force || entity.getTag("FrontText").getTag("Text").toString() != expected) { // Sign doesn't have the proper text
        entity.getTag("FrontText").setTag("Text", new NbtString(expected)) // Update the sign's text
        sign.getBlockEntity().setNbt(entity) // Update the NBT to display the right text (re-runs this function)
        log("Updated sign text!")
    }
}

// Return whether or not a block is placed on the front of a container
function placedOnContainer(block) {
    let facing = block.getBlockState().facing_direction // Store the direction the sign is facing
    if (facing == null || facing < 2 || facing > 5) { // Facing value is invalid
        return(false) // Return false, since something is wrong
    }
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Store the container block
    let target_facing = target_block.getBlockState().facing_direction // Store the direction the container is facing
    return(target_block.hasContainer() && facing == (compass[target_facing] == null ? facing : target_facing)) // Return whether or not the sign is placed on a container
}

// Create the lock after text is written by the player or the initial placement event
function blockChanged(before, after) {
    if (!after.name.includes("wall_sign")) { // Sign not being placed
        return // Quit the function
    }
    else if (storage.get(after.pos.toString()) != null) { // The sign is already apart of a lock
        resetSign(after, false) // Reset the text if was changed
        return
    }
    let access = after.getBlockEntity().getNbt().getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    if (access[0].toLowerCase() != "[lock]") { // The sign isn't meant to lock
        return // Quit the function
    }
    else if (!placedOnContainer(after) || access.length == 1) { // The lock-sign isn't placed on a container, or on it's front, or there's no players with access
        after.destroy(false) // Break the sign
        mc.spawnItem(mc.newItem(after.name.substring(0, after.name.indexOf("wall_sign")) + "sign", 1), after.pos) // Summon a dropped sign
        return(false) // Quit the function
    }
    let object = { // JSON object to be held in storage.json
        "sign": after.name, // Record the sign type
        "list": access.slice(1), // Record the access list
    }
    storage.set(after.pos.toString(), object) // Create the list of players with access
    log("Created access tag and updated sign NBT.")
}

// Create the sign text NBT after a sign is first placed on a container
function afterPlace(player, block) {
    if (!block.name.includes("wall_sign")) { // Sign not being placed
        return // Quit the function
    }
    let lock = getLockPieces(block) // Store the lock chests/signs if a lock exists
    let access_list = getAccessList(lock) // Store the list of players with access
    if (!(access_list.includes(player.name) || access_list.length == 0)) { // A lock exists and the player doesn't have access
        log("Lock already exists! You're trying to bypass it!")
        mc.spawnItem(mc.newItem(block.name.substring(0, block.name.indexOf("walL_sign")) + "sign", 1), block.pos) // Summon a dropped sign
        if (storage.get(block.pos.toString()) != null) { // Block is apart of a lock
            resetSign(block) // Reset the sign
        }
        else { // Block isn't apart of a lock
            block.destroy(false) // Break the sign
        }
        return // Quit the function (without interrupting in case lock-sign gets replaced)
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    entity.setString("Text", "") // Set the text of the sign, just to trigger the 'blockChanged' function
    block.getBlockEntity().setNbt(entity) // Update the NBT to trigger the 'blockChanged' function
    log("Updated sign text.")
}

// Need to detect lock sign addition to locked containers without access (allow non-lock signs)
// Need to prevent hopper outputting to locked containers without access
// Need to store users in permissions.json and do Username based off of xuid

// Create the event listeners to run the plugin
mc.listen("onBlockChanged", blockChanged) // Listen for sign block changed
mc.listen("afterPlaceBlock", afterPlace) // Listen for sign block placed
mc.listen("onOpenContainer", (player, block) => { // Listen for player opening container
    let access_list = getAccessList(getLockPieces(block)) // Store the players with access to the lock (if lock exists)
    return(access_list.includes(player.name) || access_list.length == 0) // Allow the player access to the container if not 'locked'
})
mc.listen("onDestroyBlock", (player, block) => { // Listen for chest or sign destruction
    if (!block.name.includes("wall_sign") && !block.hasContainer()) { // Block can't be apart of a lock
        log("Ignored Destruction")
        return // Quit the function
    }
    else if (block.name.includes("wall_sign") && storage.get(block.pos.toString()) == null) { // Sign isn't apart of a lock
        return // Quit the function
    }
    let lock = getLockPieces(block) // Store the lock chests/signs
    let access_list = getAccessList(lock) // Store the players with access to the lock
    let authenticated = access_list.includes(player.name) // Determine if the player has access
    if (access_list.length == 0) { // The lock doesn't exist
        log("Unlocked container!")
        return // Quit the function
    }
    setTimeout(() => { // Re-connect all the chests
        resetBlocks(lock.chests) // Replace all the chests
    }, 500)
    if (authenticated || config.get("PlayerGreifing") || (config.get("AdminGreifing") && player.isOP())) { // Player is authenticated, or greifing is enabled
        log("Destroyed lock!")
        breakLock(lock.signs) // Destroy the lock-signs on the lock
    }
    else { // The Player isn't authenticated, and no greifing is enabled
        log("Protected lock!")
        setTimeout(() => { // Re-connect all signs
            resetBlocks(lock.signs) // Replace all the signs
        }, 500)
    }
    return(false) // Don't break the block because the lock was destroyed
})
// Explosion takes 2 attempts to break the lock. --> Destroys the onDestroyBlock listener
mc.listen("onExplode", (source, pos, radius, maxResistance, isDestroy, isFire) => { // Listen for explosion destruction
    let list = new Set() // List of all destroyed locks
    for (let x=-1 * radius; x<=radius; x++) { // Go through the Math.abs(x) change
        for (let y=-1 * radius; y<=radius; y++) { // Go through the Math.abs(y) change
            for (let z=-1 * radius; z<=radius; z++) { // Go through the Math.abs(z) change
                let block = mc.getBlock(pos.x + x, pos.y + y, pos.z + z, pos.dimid) // Add each block
                if (!block.name.includes("wall_sign") && !block.hasContainer()) { // The block isn't apart of a lock
                    continue // Keep going
                }
                let lock = getLockPieces(block) // Store the lock components
                log(block.name)
                log(block.pos)
                if (getAccessList(lock).length == 0) { // The lock has nobody with access
                    continue // Keep going
                }
                list.add(lock) // Add the block
                for (let item of [ ...lock.chests, ...lock.signs ]) { // Go through each component
                    if (item == null) { // Not apart of lock
                        continue // Keep going
                    }
                    mc.setBlock(item.pos, "minecraft:air", 0) // Replace the lock component with air
                }
            }
        }
    }
    setTimeout(() => { // Re-connect all the chests
        for (let lock of list) { // Go through each lock
            resetBlocks(lock.chests) // Replace all the chests
        }
    }, 500)
    if ((config.get("TNTGreifing") && source.name.includes("TNT")) || (config.get("MobGreifing") && !source.name.includes("TNT"))) { // TNT and Mob Greifing are enabled
        log("Explosion destroyed " + list.size + " locks!")
        for (let lock of list) { // Go through each lock
            breakLock(lock.signs) // Destroy the lock-signs on the lock
        }
    }
    else { // TNT and Mob Greifing are disabled
        log("Prevented explosion of " + list.size + " locks!")
        setTimeout(() => { // Re-connect all the signs
            for (let lock of list) { // Go through each lock
                resetBlocks(lock.signs) // Replace all the signs
            }
        }, 500)
    }
})
mc.listen("onHopperSearchItem", (pos, isMinecart, item) => { // Listen for hopper item being absorbed
    let above = mc.getBlock(pos.x, pos.y + 1, pos.z, pos.dimid) // Try to get the block above the minecart
    if (config.get("AllowHopperStealing") || (!above.name.includes("wall_sign") && !above.hasContainer())) { // Can't be apart of a lock
        return // Quit the function
    }
    let access_list = getAccessList(getLockPieces(above)) // Get the list of players with access to the lock above the minecart (if exists)
    if (access_list.size == 0) { // No players listed on the lock (if exists at all) 
        return // Quit the function
    }
    else if (isMinecart) { // Block above is locked, and trying to drain into Minecart
        return(false) // Can't lock a minecart
    }
    let hopper_access = getAccessList(getLockPieces(mc.getBlock(pos))) // Get the list of players with access to the hopper (if exists)
    return(("" + access_list) == ("" + hopper_access)) // Return whether or not the hopper should absorb items from the locked chest
})

// Create the configuration files for the plugin
// Should implement grief prevention
function initializeConfigs() {
    let STORAGE = {
    }
    let CONFIG = {
        "WarnSelfLockout": true, // Warn users if they will lock themselves out of a chest
        "AllowSelfLockout": true, // Allow players to lock themselves out of a chest
        "AllowHopperStealing": false, // Allow players to steal from locked chests using hoppers
        "WarnAccessDenial": true, // Tell the user if they don't have access
        "AdminGreifing": false, // Prevent admins from breaking locks
        "PlayerGreifing": false, // Prevent players from breaking locks
        "MobGreifing": false, // Prevent mobs from breaking locks
        "TNTGreifing": true, // Prevent TNT from breaking locks
    }
    storage = new JsonConfigFile("plugins/LLContainerLock/storage.json", JSON.stringify(STORAGE)) // Import the storage configuration
    config = new JsonConfigFile("plugins/LLContainerLock/config.json", JSON.stringify(CONFIG)) // Import the settings configuration
}
