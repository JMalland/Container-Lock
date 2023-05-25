ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [2,1,0], {"Author": "JTM"})

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
    let facing = block.getBlockState().facing_direction // Store the direction the block is facing
    let new_pos = compass[facing](block.pos) // Store the expected sign position
    if (block.hasContainer()) { // Block is a container block, not the sign
        block = mc.getBlock(new_pos) // Store what should be the sign block
    }
    if (!block.name.includes("wall_sign") && storage.get(new_pos.toString()) != null) { // Block is not a sign, but should be
        mc.setBlock(new_pos, "minecraft:wall_sign") // Replace the block
        let nbt = mc.getBlock(new_pos).getNbt() // Store the block NBT
        mc.getBlock(new_pos).getNbt().getTag("states").setTag("facing_direction", new NbtInt(facing)) // Set the facing direction
        block.setNbt(nbt) // Update the nbt
        resetLockText(block, true) // Replace the text on the sign
        log("Replaced Lock Sign!")
    }
    else if (!block.name.includes("wall_sign")) { // Block is not a sign
        return(null) // Return nothing, since no sign
    }
    return(block) // Return the sign block
}

function resetLockText(block, force) {
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    let list = storage.get(block.pos.toString()) // Store the access list
    let expected = "[Lock]" // Initial line of the sign's text
    for (let line of list) { // Go through each player with access
        expected += "\n" + line // Add each line
    }
    if (force || entity.getTag("FrontText").getTag("Text").toString() != expected) { // Sign doesn't have the proper text
        entity.getTag("FrontText").setTag("Text", new NbtString(expected)) // Update the sign's text
        block.getBlockEntity().setNbt(entity) // Update the NBT to display the right text (re-runs this function)
        log("Updated sign text!")
    }
}

// Return whether or not a block is placed on the front of a container
function placedOnContainer(block) {
    let facing = parseInt(block.getNbt().getTag("states").getTag("facing_direction").toString()) // Store the direction the sign is facing
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
    }
    log("You have access to this container.")
    return("access") // Quit the function
}

// Create the lock after text is written by the player or the initial placement event
function blockChanged(before, after) {
    if (!before.name.includes("wall_sign")) { // The first block wasn't a sign, so it doesn't matter
        return // Quit the function
    }
    else if (!after.name.includes("wall_sign") || !placedOnContainer(after)) { // Sign not being placed
        return // Quit the function
    }
    let access = after.getBlockEntity().getNbt().getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    if (storage.get(after.pos.toString()) != null) { // The sign is already apart of a lock
        resetLockText(after, false) // Reset the text displayed on the lock (checks if text is not right, so not infinite loop)
        return
    }
    else if (access[0].toLowerCase() != "[lock]") { // The sign isn't meant to lock
        return // Quit the function
    }
    if (!access.includes(player.name)) { // Player isn't included with access to the lock
        // Create WarnSelfLockout
        // Create AllowSelfLockout
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
        let entity = block.getBlockEntity().getNbt() // Store the entity NBT
        let second_block = null // Default value for the second block
        if (entity.getTag("pairx") != null && entity.getTag("pairz") != null) { // The container is a large chest, of sorts
            second_block = getLockSign(mc.getBlock(parseInt(entity.getTag("pairx").toString()), block.pos.y, parseInt(entity.getTag("pairz").toString()), block.pos.dimid)) // Get the sign block apart of the second chest
        }
        return(validateLock(player, getLockSign(block)) != "locked" || validateLock(player, second_block) != "locked") // Allow the player access to the container if not 'locked'
    })
    mc.listen("onDestroyBlock", (player, block) => { // Listen for chest or sign destruction
        // (only works per that chest, not large chests)
        // Need to disable destruction for large chests with signs, even if not one on single side.
        let sign_block = getLockSign(block) // Get the sign block that's apart of the lock
        let authenticate = validateLock(player, sign_block) // Validate the player's access to the lock
        if (authenticate == "access" && sign_block != null) { // The player has access to the lock
            storage.delete(sign_block.pos.toString()) // Remove the lock from the storage (runs if not apart of a lock)
        }
        else if (authenticate == "locked") { // The player doesn't have access (but sign appears blank to them)
            resetLockText(sign_block, true) // Reset the sign's text, since would appear blank to the player
        }
        log("Lock: " + authenticate)
        return(authenticate != "locked") // Quit the function, breaking the block since player had access, or wasn't apart of a lock
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