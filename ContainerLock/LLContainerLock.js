ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [1,0,0], {"Author": "JTM"})

compass = { // Calculate the position in a given direction
    "2": (pos) => { return(new IntPos(pos.x, pos.y, pos.z - 1, pos.dimid)) },
    "3": (pos) => { return(new IntPos(pos.x, pos.y, pos.z + 1, pos.dimid)) },
    "4": (pos) => { return(new IntPos(pos.x - 1, pos.y, pos.z, pos.dimid)) },
    "5": (pos) => { return(new IntPos(pos.x + 1, pos.y, pos.z, pos.dimid)) }
}

wood = ["spruce", "jungle", "acacia", "birch", "dark_oak", "mangrove", "warped", "crimson"] // List of all wood sign types

function blockChanged(before, after) {
    if (!after.name.includes("_sign")) { // Sign not being placed
        return // Quit the function
    }
    let entity_nbt = after.getBlockEntity().getNbt() // Store the block's parent NBT
    let access = entity_nbt.getTag("FrontText").getTag("Text").toString().split("\n") // List of all players with access to the locked block (must be a container)
    let facing = after.getBlockState().facing_direction // Store the direction the sign is facing
    let target_block = mc.getBlock(compass[facing + (facing%2 == 0 ? 1 : -1)](after.pos)) // Store the block the sign was placed on
    if (entity_nbt.getTag("access") != null) { // The sign already has 'access' players
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
        access[i] = new NbtString(access[i]) // Convert the string into an NbtString
    }
    entity_nbt.setTag("access", new NbtList(access.slice(1))) // Create the 'access' tag for the sign, declaring who has access to the container
    after.getBlockEntity().setNbt(entity_nbt) // Update the sign's NBT
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

function openContainer(player, block) {
    log("Opened Container!")
    let facing = block.getBlockState().facing_direction // Store the direction the sign is facing
    let target_block = mc.getBlock(compass[facing](block.pos)) // Store the sign in front of the container
    log(target_block.name)
    let access_list = target_block.getBlockEntity().getNbt().getTag("access") // Store the block's 'access' list
    if (access_list != null) { // The sign has the 'access' tag
        let found = false // Store whether or not the player is within the access list
        for (let i=0; i<access_list.getSize(); i++) { // Get the users stored in the 'access' list
            found = found || access_list.getTag(i).toString() == player.name // Determine if player was found
        }
        if (!found) { // Player was not found within the list
            log("You don't have access to this chest!")
            return(false) // Quit the function
        }
    }
    else {
        log("No Access List!")
    }
}

// Should first break sign, even if destroying the chest
// Second break should work automatically, having the sign removed.
function destroyContainer(player, block) {

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
    mc.listen("onOpenContainer", openContainer) // Listen for player opening container
    mc.listen("onStartDestroyBlock", (player, block) => { return })
}

initializeListeners()