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

// Return the block that should be the sign, assuming the block is apart of a lock
function getLockSign(block) {
    if (block == null) { // Block is invalid
        return(null) // Return nothing, since no sign
    }
    let facing = block.getBlockState().facing_direction // Store the direction the block is facing
    let new_pos = compass[facing](block.pos) // Store the expected sign position
    block = block.hasContainer() ? mc.getBlock(new_pos) : block // Store what should be the sign block
    if (!block.name.includes("wall_sign") && storage.get(new_pos.toString()) != null) { // Block is not a sign, but should be
        mc.setBlock(new_pos, "minecraft:wall_sign") // Replace the block
        let nbt = mc.getBlock(new_pos).getNbt() // Store the block NBT
        mc.getBlock(new_pos).getNbt().getTag("states").setTag("facing_direction", new NbtInt(facing)) // Set the facing direction
        block.setNbt(nbt) // Update the nbt
        resetLockText(block, true) // Replace the text on the sign
        log("Replaced Lock Sign!")
    }
    return(block.name.includes("wall_sign") ? block : null) // Return the sign block, or nothing if no sign
}

// Return the chest connected to another chest
function getSecondChest(block) {
    if (block != null || !block.hasContainer()) {
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
    if (block == null || !block.name.includes("wall_sign")) { // Block is not a sign
        return // Quit the function
    }
    let list = storage.get(block.pos.toString()) // Store the access list
    if (list == null) { // Lock doesn't exist
        return // Quit the function
    }
    let expected = "[Lock]" // Initial line of the sign's text
    for (let line of list) { // Go through each player with access
        expected += "\n" + line // Add each line
    }
    if (force || entity.getTag("FrontText").getTag("Text").toString() != expected) { // Sign doesn't have the proper text
        let entity = block.getBlockEntity().getNbt() // Store the entity NBT
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

// Return whether or not a player has access to the block, even if it isn't a lock
function validateLock(player, block) {
    let access = block == null ? block : storage.get(block.pos.toString()) // Store the lock access list
    if (access != null) { // The block is apart of a lock
        if (!storage.get(block.pos.toString()).includes(player.name) && !(config.get("AdminGreifing") && player.isOP())) { // Player doesn't have access to the chest
            log("You are locked out of this container.")
            return("locked") // Quit the function
        }
        log("You have access to this container.")
        return("access") // Quit the function
    }
    log("This container is unlocked.")
    return("unlocked") // Quit the function
}

// Create the lock after text is written by the player or the initial placement event
function blockChanged(before, after) {
    if (!after.name.includes("wall_sign") || !placedOnContainer(after)) { // Sign not being placed
        return // Quit the function
    }
    let access = after.getBlockEntity().getNbt().getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    if (storage.get(after.pos.toString()) != null) { // The sign is already apart of a lock
        resetLockText(after, false) // Reset the text displayed on the lock (checks if text is not right, so not infinite loop)
        return // Quit the function
    }
    else if (access[0].toLowerCase() != "[lock]") { // The sign isn't meant to lock
        return // Quit the function
    }
    storage.set(after.pos.toString(), access.slice(1)) // Create the list of players with access
    log("Created access tag and updated sign NBT.")
}

// Create the sign text NBT after a sign is first placed on a container
function afterPlace(player, block) {
    if (!block.name.includes("wall_sign") || !placedOnContainer(block)) { // Sign not being placed
        return // Quit the function
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    entity.setString("Text", "") // Set the text of the sign, just to trigger the 'blockChanged' function
    block.getBlockEntity().setNbt(entity) // Update the NBT to trigger the 'blockChanged' function
    log("Updated sign text.")
}

// Create the event listeners to run the plugin
function initializeListeners() {
    mc.listen("onBlockChanged", blockChanged) // Listen for sign block changed
    mc.listen("afterPlaceBlock", afterPlace) // Listen for sign block placed
    mc.listen("onOpenContainer", (player, block) => { // Listen for player opening container
        return(validateLock(player, getLockSign(block)) != "locked" || validateLock(player, getLockSign(getSecondChest(block))) != "locked") // Allow the player access to the container if not 'locked'
    })
    mc.listen("onDestroyBlock", (player, block) => { // Listen for chest or sign destruction
        // (only works per that chest, not large chests)
        // Need to fix destroying locked chests breaking apart large ones into 2 singles. 
        let authentication = false // Authenticate the player's access to the lock
        let unlocked = true // Whether or not the container isn't locked
        let signs = [getLockSign(block), getLockSign(getSecondChest(block))] // Store the lock signs (assuming a large chest)
        for (let i=0; i<signs.length; i++) { // Go through each sign
            let validate = validateLock(player, signs[i%signs.length]) // Validate the access
            authentication = authentication || validate == "access" // Evaluate the authentication
            unlocked = unlocked && validate == "unlocked" // Evaluate the lock
        }
        for (let i=0; i<signs.length; i++) { // Go through each sign (once more)
            if (signs[i%signs.length] != null) { // The lock exists
                if (authentication) { // Player has access to lock
                    storage.delete(signs[i%signs.length].pos.toString()) // Remove the lock from storage
                    signs[i%signs.length].destroy(true) // Destroy the sign
                    continue // Keep going
                }
                resetLockText(signs[i%signs.length]) // Reset the sign's text
            }
        }
        log("Lock: " + (unlocked || authentication))
        return(unlocked || authentication) // Quit the function, breaking the block since player had access, or wasn't apart of a lock
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
