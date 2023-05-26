ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [2,2,0], {"Author": "JTM"})

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

wood = ["spruce", "jungle", "acacia", "birch", "dark_oak", "mangrove", "warped", "crimson"] // List of all wood sign types

// Should reimplement getting lock signs and stuff
function getLockPieces(block) {
    let facing = block.getBlockState().facing_direction
    let chest_one = block.hasContainer() ? block : mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Get the first locked chest
    let object = {} // Store the values in an object. Easier than using '.length%i'
    object.chests = [chest_one, getSecondChest(chest_one)] // Store the chests in an array
    object.signs = [mc.getBlock(compass[facing](chest_one.pos)), object.chests[1] != null ? mc.getBlock(compass[facing](object.chests[1].pos)) : null] // Store the signs in an array
    for (let i=0; i<object.signs.length; i++) { // Go through each sign
        if (object.signs[i] != null) { // Block exists --> Signs end up null if not lock, or sign
            if (storage.get(object.signs[i].pos.toString()) == null) { // Block isn't apart of a lock
                object.signs[i] = null // Erase the block from the list, since irrelevant
            }
            else if (!object.signs[i].name.includes("wall_sign")) { // Block is not a sign, but should be
                mc.setBlock(compass[facing](object.signs[i].pos), storage.get(object.signs[i].pos.toString()).sign) // Replace the block
                object.signs[i] = mc.getBlock(compass[facing](object.signs[i].pos)) // Update the block
                let nbt = object.signs[i].getNbt() // Store the block NBT
                nbt.getTag("states").setTag("facing_direction", new NbtInt(facing)) // Set the facing direction
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

function resetLockText(block, force) {
    //if (block == null || !block.name.includes("wall_sign")) { // Block is not a sign
    //    return // Quit the function
    //}
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
    let facing = parseInt(block.getNbt().getTag("states").getTag("facing_direction").toString()) // Store the direction the sign is facing
    if (facing == null || facing < 2 || facing > 5) { // Facing value is invalid
        return(false) // Return false, since something is wrong
    }
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Store the block the sign was placed on
    return(target_block.hasContainer()) // Return whether or not the sign is placed on a container
}

// Return whether or not a player should have access to a container, based on the lock-signs
function authenticatePlayer(player, signs) {
    let authenticated = false // Authenticate the player's access to the lock
    let unlocked = true // Whether or not the container isn't locked
    for (let sign of signs) { // Go through each sign
        let access = sign == null ? sign : storage.get(sign.pos.toString()) // Store the lock access list
        if (access != null) { // The block is apart of a lock
            if (!access.list.includes(player.name) && !(config.get("AdminGreifing") && player.isOP())) { // Player doesn't have access to the chest
                authenticated = authenticated || false // Whether or not the player has access to a lock
            }
            else {
                authenticated = true // The player has access, for certain
            }
        }
        unlocked = unlocked && access == null // Whether or not there's a lock on the container
    }
    log("Authenticated: " + authenticated)
    log("Unlocked: " + unlocked)
    return(authenticated || unlocked) // Return the player's access
}

// Create the lock after text is written by the player or the initial placement event
function blockChanged(before, after) {
    if (!after.name.includes("wall_sign") || !placedOnContainer(after)) { // Sign not being placed
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
    object = { // JSON object to be held in storage.json
        "sign": after.name, // Record the sign type
        "list": access.slice(1), // Record the access list
    }
    storage.set(after.pos.toString(), object) // Create the list of players with access
    log("Created access tag and updated sign NBT.")
}

// Create the sign text NBT after a sign is first placed on a container
function afterPlace(player, block) {
    if (!block.name.includes("wall_sign") || !placedOnContainer(block)) { // Sign not being placed
        return // Quit the function
    }
    let lock = getLockPieces(block) // Store the lock chests/signs if a lock exists
    if (lock.signs[1] != null && !storage.get(lock.signs[1].pos.toString()).list.includes(player.name)) { // A lock exists and the player doesn't have access
        log("Lock already exists! You're trying to bypass it!")
        block.destroy(true) // Break the sign
        return(false) // Quit the function
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    entity.setString("Text", "") // Set the text of the sign, just to trigger the 'blockChanged' function
    block.getBlockEntity().setNbt(entity) // Update the NBT to trigger the 'blockChanged' function
    log("Updated sign text.")
}

// Create the event listeners to run the plugin
// Need to block placing signs on a locked container
function initializeListeners() {
    mc.listen("onBlockChanged", blockChanged) // Listen for sign block changed
    mc.listen("afterPlaceBlock", afterPlace) // Listen for sign block placed
    mc.listen("onOpenContainer", (player, block) => { // Listen for player opening container
        return(authenticatePlayer(player, getLockPieces(block).signs)) // Allow the player access to the container if not 'locked'
    })
    mc.listen("onDestroyBlock", (player, block) => { // Listen for chest or sign destruction
        if (!block.name.includes("wall_sign") && !block.hasContainer()) { // Block can't be apart of a lock
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
        if (block.hasContainer() && !(has_access && !destroyed)) { // Re-Merge the chests if the block is a container
            let entity = block.getBlockEntity().getNbt() // Store the entity Nbt
            setTimeout(() => {block.getBlockEntity().setNbt(entity)}, 500) // Update the block Nbt
        }
        return(has_access && !destroyed) // Quit the function, breaking the block since player had access, or wasn't apart of a lock
    })
}

function initializeConfigs() {
    STORAGE = {
    }
    CONFIG = {
        "WarnSelfLockout": true, // Warn users if they will lock themselves out of a chest
        "AllowSelfLockout": true, // Allow users to lock themselves out of a chest
        "WarnAccessDenial": true, // Tell the user if they don't have access
        "AdminGreifing": false, // Prevent admins from breaking locks
        "PlayerGreifing": false, // Prevent players from breaking locks
        "MobGreifing": false, // Prevent mobs from breaking locks
        "TNTGreifing": false, // Prevent TNT from breaking locks
        "FireGreifing": false, // Prevent fire from breaking blocks
    }
    storage = new JsonConfigFile("plugins/LLContainerLock/storage.json", JSON.stringify(STORAGE)) // Import the storage configuration
    config = new JsonConfigFile("plugins/LLContainerLock/config.json", JSON.stringify(CONFIG)) // Import the settings configuration
}
