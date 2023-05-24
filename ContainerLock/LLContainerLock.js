ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [1,0,0], {"Author": "JTM"})

var storage = {}
var config = {}

initializeConfigs()
initializeListeners()

compass = { // Calculate the position in a given direction
    "2": (pos) => { return(new IntPos(pos.x, pos.y, pos.z - 1, pos.dimid)) },
    "3": (pos) => { return(new IntPos(pos.x, pos.y, pos.z + 1, pos.dimid)) },
    "4": (pos) => { return(new IntPos(pos.x - 1, pos.y, pos.z, pos.dimid)) },
    "5": (pos) => { return(new IntPos(pos.x + 1, pos.y, pos.z, pos.dimid)) }
}

wood = ["spruce", "jungle", "acacia", "birch", "dark_oak", "mangrove", "warped", "crimson"] // List of all wood sign types

function validateLock(player, block) {
    let facing = block.getBlockState().facing_direction // Store the direction the sign is facing
    block = block.hasContainer() ? mc.getBlock(compass[facing](block.pos)) : block // Update the block to be whatever's in front of the container
    let access = storage.get(block.pos.toString()) // Store the lock access list
    if (block.name.includes("_sign") && access != null) { // The block could be apart of a lock
        if (access.includes(player.name) || (config.get("AdminGreifing") && player.isOP())) { // The player has access to the chest, or is an OP
            log("You have access to this container.")
            return(block.pos) // Quit the function
        }
        else if (!storage.get(block.pos.toString()).includes(player.name)) { // Player doesn't have access to the chest
            log("You are locked out of this container.")
            return("locked") // Quit the function
        }
    }
    log("Not apart of a lock!")
    return(null) // Quit the function
}

function blockChanged(before, after) {
    if (!after.name.includes("_sign")) { // Sign not being placed
        return // Quit the function
    }
    let entity_nbt = after.getBlockEntity().getNbt() // Store the block's parent NBT
    let access = entity_nbt.getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    let facing = after.getBlockState().facing_direction // Store the direction the sign is facing
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](after.pos)) // Store the block the sign was placed on
    if (storage.get(after.pos.toString()) != null) { // The sign already has 'access' players
        return // Quit the function
    }
    else if (access[0].toLowerCase() != "[lock]") { // First line references the lock
        log("Sign not used to lock.")
        return // Quit the function
    }
    else if (!target_block.hasContainer()) { // Block is not a container
        log("Isn't container, and can't lock a non-container block.")
        return // Quit the function
    }
    for (let i=1; i<access.length; i++) { // Go through each player with access
        if (mc.getPlayer(access[i]) == null) { // The player listed is invalid
            log("Player '" + (i + 1) + "' is invalid!")
            //after.destroy(true) // Destroy the block
            //return // Quit the function
        }
    }
    storage.set(after.pos.toString(), access.slice(1)) // Create the list of players with access
    log("Created access tag and updated sign NBT.")
}

function afterPlace(player, block) {
    if (!block.name.includes("_sign")) { // Sign not being placed
        return // Quit the function
    }
    let facing = block.getBlockState().facing_direction // Store the direction the sign is facing
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](block.pos)) // Store the block the sign was placed on
    if (!target_block.hasContainer()) { // Block is not a container
        log("Isn't Container!")
        return // Quit the function
    }
    let entity = block.getBlockEntity().getNbt() // Store the entity NBT
    entity.setString("Text", "") // Set the text of the sign, just to trigger the 'blockChanged' function
    block.getBlockEntity().setNbt(entity) // Update the NBT to trigger the 'blockChanged' function
    log("Updated sign text.")
}

// Need function for user placing a sign --> "onUseItem"
    // If sign is hanging
        // Get block behind sign facing
        // If container behind sign is facing the right way
            // Parse the sign for '[' + username + ']'
            // Add NBT tag 'access' to container states, and add username(s) to 'access'
        // Else, nothing
    // Else, nothing

// Need function for opening a container --> "onOpenContainer"
    // If container states contains an 'access' state
        // If user within 'access', return(true)
        // Else, return(false)
    // Else, return(true)

// Need to check if player is destroying a sign. --> "onStartDestroyBlock"
    // If destroying sign, check if it is on a chest, then check the chest's NBT for 'access'.
        // If user within 'access', return(true)
        // Else, return(false)
    // Else, nothing

function initializeListeners() {
    mc.listen("onBlockChanged", blockChanged) // Listen for block change
    mc.listen("afterPlaceBlock", afterPlace) // Listen for block change
    mc.listen("onOpenContainer", (player, block) => {
        return(validateLock(player, block) != "locked")
    }) // Listen for player opening container
    mc.listen("onDestroyBlock", (player, block) => {
        let authenticate = validateLock(player, block) // Validate the player's access to the lock
        if (authenticate == "locked") { // Player doesn't have access
            return(false) // Quit the function
        }
        else if (authenticate == null) { // Block is not apart of a lock
            return(true) // Quit the function
        }
        else { // The authentication returned the position of the sign within the lock
            storage.delete(authenticate.toString()) // Remove the lock from storage
            mc.getBlock(authenticate).destroy(true) // Break the sign part of the lock
        }
        return(false) // Quit the function
    })
}

function initializeConfigs() {
    STORAGE = {
    }
    CONFIG = {
        "WarnSelfLockout": true, // Warn users if they will lock themselves out of a chest
        "AllowSelfLockout": true, // Allow users to lock themselves out of a chest
        "WarnAccessDenial": true, // Tell the user if they don't have access
        "PlayerGreifing": false, // Prevent players from breaking locks
        "MobGreifing": false, // Prevent mobs from breaking locks
        "AdminGreifing": false, // Prevent admins from breaking locks
    }
    storage = new JsonConfigFile("plugins/LLContainerLock/storage.json", JSON.stringify(STORAGE)) // Import the storage configuration
    config = new JsonConfigFile("plugins/LLContainerLock/config.json", JSON.stringify(CONFIG)) // Import the settings configuration
}
