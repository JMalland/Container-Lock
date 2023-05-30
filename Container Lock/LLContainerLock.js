ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [2,3,3], {"Author": "JTM"})

var storage = {}
var config = {}

initializeConfigs()
initializeListeners()

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
    let object = {} // Store the values in an object. Easier than using '.length%i'
    object.chests = [chest_one, getSecondChest(chest_one)] // Store the chests in an array
    if (object.chests[1] == null && compass[chest_one.getBlockState().facing_direction] == null) { // No large chest, and container has no 'facing' direction
        object.signs = [] // Empty list to store signs
        for (let i=2; i<=5; i++) { // Go through each cardinal direction
            let sign = mc.getBlock(compass[i](chest_one.pos)) // Store the potential sign block
            sign.pos = compass[i](chest_one.pos) // Update the PosInt value of the block
            if (compass[sign.getBlockState().facing_direction] == null) { // The sign isn't facing the proper direction (isn't apart of this lock)
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
            if (storage.get(object.signs[i].pos.toString()) == null) { // Block isn't apart of a lock
                object.signs[i] = null // Erase the block from the list, since irrelevant
            }
            else if (!object.signs[i].name.includes("wall_sign")) { // Block is not a sign, but should be
                log(object.signs[i].name)
                mc.setBlock(object.signs[i].pos, storage.get(object.signs[i].pos.toString()).sign) // Replace the block
                object.signs[i] = mc.getBlock(object.signs[i].pos) // Update the block
                let nbt = object.signs[i].getNbt() // Store the block NBT
                nbt.getTag("states").setTag("facing_direction", new NbtInt(object.signs.length > 2 ? i + 2 : facing)) // Set the facing direction
                object.signs[i].setNbt(nbt) // Update the block NBT
                resetLockText(object.signs[i], true) // Replace the text on the sign
                log("Replaced Lock Sign!")
            }
        }
    }
    return(object) // Return an object containing signs/chests
}

// Return the chest connected to another chest
function getSecondChest(block) {
    if (block == null || !block.hasContainer()) { // Block doesn't exist, or isn't a container
        return(null) // Return nothing, since not a chest
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    let pairx = entity.getTag("pairx") // Store the paired x coordinate
    let pairz = entity.getTag("pairz") // Store the paired z coordinate
    if (pairx != null && pairz != null) { // There's a paired chest
        return(mc.getBlock(parseInt(pairx), block.pos.y, parseInt(pairz), block.pos.dimid)) // Return the paired chest
    }
    return(null) // Return nothing, since not a chest
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
    access_list.sort() // Sort the array
    return(access_list) // Return the array
}

function resetLockText(block, force) {
    let expected = "[Lock]" // Initial line of the sign's text
    if (storage.get(block.pos.toString()) == null) { // The block isn't a lock
        return // Quit the function
    }
    for (let line of storage.get(block.pos.toString()).list) { // Go through each player with access
        expected += "\n" + line // Add each line
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    if (force || entity.getTag("FrontText").getTag("Text").toString() != expected) { // Sign doesn't have the proper text
        entity.getTag("FrontText").setTag("Text", new NbtString(expected)) // Update the sign's text
        block.getBlockEntity().setNbt(entity) // Update the NBT to display the right text (re-runs this function)
        log("Updated sign text!")
    }
}

// Return whether or not a block is placed on the front of a container
function placedOnContainer(block) {
    let facing = block.getBlockState().facing_direction // Store the direction the sign is facing
    if (facing == null || facing < 2 || facing > 5) { // Facing value is invalid
        return(false) // Return false, since something is wrong
    }
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Store the block the sign was placed on
    let target_facing = target_block.getBlockState().facing_direction // Store the direction the container is facing
    return(target_block.hasContainer() && facing == (compass[target_facing] == null ? facing : target_facing)) // Return whether or not the sign is placed on a container
}

// Return whether or not a player should have access to a container, based on the lock-signs
function authenticatePlayer(player, signs) {
    let authenticated = false // Authenticate the player's access to the lock
    let unlocked = true // Whether or not the container isn't locked
    for (let sign of signs) { // Go through each sign
        if (sign == null) { // Sign not apart of lock
            continue // Keep going
        }
        let access = storage.get(sign.pos.toString()) // Store the lock access list
        if (!access.list.includes(player.name) && !(config.get("AdminGreifing") && player.isOP())) { // Player doesn't have access to the chest
            authenticated = authenticated || false // Whether or not the player has access to a lock
        }
        else {
            authenticated = true // The player has access, for certain
        }
        unlocked = unlocked && access == null // Whether or not there's a lock on the container
    }
    log("Authenticated: " + authenticated)
    log("Unlocked: " + unlocked)
    return(authenticated || unlocked) // Return the player's access
}

// Create the lock after text is written by the player or the initial placement event
function blockChanged(before, after) {
    if (!after.name.includes("wall_sign")) { // Sign not being placed
        return // Quit the function
    }
    else if (storage.get(after.pos.toString()) != null) { // The sign is already apart of a lock
        resetLockText(after, false) // Reset the text if was changed
        return
    }
    let access = after.getBlockEntity().getNbt().getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    if (access[0].toLowerCase() != "[lock]") { // The sign isn't meant to lock
        return // Quit the function
    }
    else if (!placedOnContainer(after)) { // The lock-sign isn't placed on a container, or on it's front
        after.destroy(true) // Break the sign
        return(false) // Quit the function
    }
    object = { // JSON object to be held in storage.json
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
    if (!authenticatePlayer(player, lock.signs)) { // A lock exists and the player doesn't have access
        log("Lock already exists! You're trying to bypass it!")
        block.destroy(true) // Break the sign
        return(false) // Quit the function
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    entity.setString("Text", "") // Set the text of the sign, just to trigger the 'blockChanged' function
    block.getBlockEntity().setNbt(entity) // Update the NBT to trigger the 'blockChanged' function
    log("Updated sign text.")
}

function getExplodedBlocks(pos, radius, maxResist) {
    let list = []
    log(maxResist)
    for (let x=-1 * radius; x<=radius; x++) { // Go through the Math.abs(x) change
        for (let y=-1 * radius; y<=radius; y++) { // Go through the Math.abs(y) change
            for (let z=-1 * radius; z<=radius; z++) { // Go through the Math.abs(z) change
                let block = mc.getBlock(pos.x + x, pos.y + y, pos.z + z, pos.dimid) // Add each block
                if ((block.name.includes("wall_sign") && !block.hasContainer()) || getAccessList(getLockPieces(block)).length == 0) { // The lock doesn't exist
                    continue // Keep going
                }
                list.push(block) // Add the block 
            }
        }
    }
    return(list) // Return the list of blocks
}

// Create the event listeners to run the plugin
// Detect hopper absorbtion of items from locked entity. Refuse unless locked by main owner
function initializeListeners() {
    mc.listen("onBlockChanged", blockChanged) // Listen for sign block changed
    mc.listen("afterPlaceBlock", afterPlace) // Listen for sign block placed
    mc.listen("onOpenContainer", (player, block) => { // Listen for player opening container
        return(authenticatePlayer(player, getLockPieces(block).signs)) // Allow the player access to the container if not 'locked'
    })
    mc.listen("onDestroyBlock", (player, block) => { // Listen for chest or sign destruction
        if (config.get("PlayerGreifing") || (!block.name.includes("wall_sign") && !block.hasContainer())) { // Block can't be apart of a lock
            return // Quit the function
        }
        let lock = getLockPieces(block) // Store the lock chests/signs
        let has_access = authenticatePlayer(player, lock.signs) // Determine if the player has access
        let destroyed = false // Whether or not the lock has been broken
        for (let sign of lock.signs) { // Go through each sign (once more)
            if (sign != null && has_access) { // The lock exists and the player has access
                storage.delete(sign.pos.toString()) // Remove the lock from storage
                sign.destroy(true) // Destroy the sign
                destroyed = true // Update the destruction
                log("Removed Lock.")
            }
            else if (sign != null) { // The lock exists, but player doesn't have access
                log("Reset Lock Text.")
                resetLockText(sign, true) // Reset the sign's text
            }
        }
        setTimeout(() => { // Re-connect all chests in real time
            lock = getLockPieces(block) // Update the lock pieces (in case changed in 500 ms)
            for (let chest of lock.chests) { // Go through each chest
                if (chest == null) { // Chest doesn't exist
                    continue // Keep going
                }
                try {
                    let entity = chest.getBlockEntity().getNbt() // Store chest NBT
                    chest.getBlockEntity().setNbt(entity) // Update the chest NBT
                }
                catch (e) {} // Do nothing with the caught exception
            }
        }, 500)
        return(has_access && !destroyed) // Quit the function, breaking the block since player had access, or wasn't apart of a lock
    })
    mc.listen("onExplode", (source, pos, radius, maxResistance, isDestroy, isFire) => { // Listen for any explosion destruction
        log("Exploded Block")
        let blocks = getExplodedBlocks(pos, radius, maxResistance)
        if (blocks.length > 0 && !config.get("TNTGreifing")) { // Blew up a lock chest, and TNT Greifing is off
            setTimeout(() => { // Replace the locks after explosion is done
                for (let block of blocks) { // Go through each block
                    let lock = getLockPieces(block) // Store the lock components
                    for (let chest of lock.chests) { // Go through each chest
                        try {
                            let entity = chest.getBlockEntity().getNbt() // Store the chest NBT
                            chest.getBlockEntity().setNbt(entity) // Update the chest NBT
                        }
                        catch (e) {}
                    }
                    for (let sign of lock.signs) { // Go through each sign
                        try {
                            let entity = sign.getBlockEntity().getNbt() // Store the sign NBT
                            sign.getBlockEntity().setNbt(entity)
                        }
                        catch (e) {}
                    }
                }
            }, 500)
        }
    })
    mc.listen("onHopperSearchItem", (pos, isMinecart, item) => { // Listen for hopper item movement
        let above = mc.getBlock(pos.x, pos.y + 1, pos.z, pos.dimid) // Try to get the block above the minecart
        if (config.get("AllowHopperStealing") || (!above.name.includes("wall_sign") && !above.hasContainer())) { // Can't be apart of a lock
            return // Quit the function
        }
        let access_list = getAccessList(getLockPieces(above)) // Get the list of players with access to the lock above the minecart (if exists)
        if (access_list.length == 0) { // No players listed on the lock (if exists at all) 
            return // Quit the function
        }
        else if (isMinecart) { // Block above is locked, and trying to drain into Minecart
            return(false) // Can't lock a minecart
        }
        let hopper_access = getAccessList(getLockPieces(mc.getBlock(pos))) // Get the list of players with access to the hopper (if exists)
        return(("" + access_list) == ("" + hopper_access)) // Return whether or not the hopper should absorb items from the locked chest
    })
}

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
