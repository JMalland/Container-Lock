ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [2,0,0], {"Author": "JTM"})

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
    if (block.hasContainer()) { // Block is a container block, not the sign
        block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Store what should be the sign block
    }
    if (!block.name.includes("_sign")) { // Block is not a sign
        return(null) // Return nothing, since no sign
    }
    return(block) // Return the sign block
}

// Return whether or not a block is placed on the front of a container
function placedOnContainer(block) {
    let facing = block.getBlockState().facing_direction // Store the direction the sign is facing
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Store the block the sign was placed on
    return(target_block.hasContainer()) // Return whether or not the sign is placed on a container
}

// Return whether or not a player has access to the block, even if it isn't a lock
function validateLock(player, block) {
    let access = block == null ? block : storage.get(block.pos.toString()) // Store the lock access list
    if (access != null) { // The block is apart of a lock
        if (!storage.get(block.pos.toString()).includes(player.name) && !(config.get("AdminGreifing") && player.isOP()) { // Player doesn't have access to the chest
            log("You are locked out of this container.")
            return("locked") // Quit the function
        }
    }
    log("You have access to this container.")
    return("access") // Quit the function
}

// Create the lock after text is written by the player or the initial placement event
function blockChanged(before, after) {
    if (!after.name.includes("_sign")) { // Sign not being placed
        return // Quit the function
    }
    let entity_nbt = after.getBlockEntity().getNbt() // Store the block's parent NBT
    let access = entity_nbt.getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    if (!placedOnContainer(after)) { // Block is not a container
        log("Isn't container, and can't lock a non-container block.")
        return // Quit the function
    }
    else if (access[0].toLowerCase() != "[lock]" || storage.get(after.pos.toString()) != null) { // The sign already has 'access' players, or isn't meant to lock
        return // Quit the function
    }
    for (let i=1; i<access.length; i++) { // Go through each player with access
        if (mc.getPlayer(access[i]) == null) { // The player listed is invalid
            if (config.get("WarnInvalidUser")) { // Warn the user a player is invalid
                log("Player '" + i + "' is invalid!")
            }
            if (!config.get("AllowInvalidUser")) { // Break the sign if player is invalid
                after.destroy(true) // Destroy the block
                return // Quit the function
            }
        }
    }
    storage.set(after.pos.toString(), access.slice(1)) // Create the list of players with access
    log("Created access tag and updated sign NBT.")
}

// Create the sign text NBT after a sign is first placed on a container
function afterPlace(player, block) {
    if (!block.name.includes("_sign") || !placedOnContainer(block)) { // Sign not being placed
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
        return(validateLock(player, getLockSign(block)) != "locked") // Allow the player access to the container if not 'locked'
    })
    mc.listen("onDestroyBlock", (player, block) => { // Listen for chest or sign destruction
        let sign_block = getLockSign(block) // Get the sign block that's apart of the lock
        let authenticate = validateLock(player, sign_block) // Validate the player's access to the lock
        if (authenticate == "access" && storage.get(sign_block.pos.toString()) != null) { // Block is apart of a lock, and player has access
            storage.delete(sign_block.pos.toString()) // Remove the lock from storage
        }
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
        "AllowInvalidUser": true, // Allow users to give a non-existant user access
        "WarnInvalidUser": true, // Tell the user if they're giving a non-existant user access
        "PlayerGreifing": false, // Prevent players from breaking locks
        "MobGreifing": false, // Prevent mobs from breaking locks
        "AdminGreifing": false, // Prevent admins from breaking locks
    }
    storage = new JsonConfigFile("plugins/LLContainerLock/storage.json", JSON.stringify(STORAGE)) // Import the storage configuration
    config = new JsonConfigFile("plugins/LLContainerLock/config.json", JSON.stringify(CONFIG)) // Import the settings configuration
}
