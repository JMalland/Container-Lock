ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [1,0,0], {"Author": "JTM"})

compass = { // Calculate the position in a given direction
    "2": (pos) => { return(new IntPos(pos.x, pos.y, pos.z - 1, pos.dimid)) },
    "3": (pos) => { return(new IntPos(pos.x + 1, pos.y, pos.z, pos.dimid)) },
    "4": (pos) => { return(new IntPos(pos.x, pos.y, pos.z + 1, pos.dimid)) },
    "5": (pos) => { return(new IntPos(pos.x - 1, pos.y, pos.z, pos.dimid)) }
}

wood = ["spruce", "jungle", "acacia", "birch", "dark_oak", "mangrove", "warped", "crimson"] // List of all wood sign types 

function useItemOn(player, item, block) {
    if (!item.name.includes("_sign") || !block.hasContainer()) { // Not a sign or container being interacted with
        return // Quit the function
    }
    
    log(item.name)
    log(item.type)
    log(item.variant)
    log(item.getNbt().toString(1))
    log(block.name)
    log(block.type)
    log(block.variant)
    log(block.getNbt().toString(1))
    log(JSON.stringify(block.getContainer()))
}

function blockChanged(before, after) {
    log(before.getNbt().toString(1))
    log(after.getNbt().toString(1))
}

function openContainer(player, block) {

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
    mc.listen("onBlockChange", blockChanged) // Listen for block change
    //mc.listen("onUseItemOn", useItemOn) // Listen for players placing blocks
    mc.listen("onStartDestroyBlock", (player, block) => { // Verify it is a container block being destroyed
        let nbt = block.getNbt() // Store block Nbt
        let state = block.getBlockState() // Store block states
        let pos = block.pos // Store block position
        let targets = [] // Store blocks to check
        if (block.hasContainer()) { // Check it is a container block
            log("Container: " + JSON.stringify(nbt))
            targets.push(mc.getBlock(compass[block.getBlockState().facing](pos))) // Add potential sign
            if (nbt.getTag("pairx") != null) { // Container is paired with a block North/South
                pos.x = nbt.getTag("pairx") // Update the x value
                targets.push(mc.getBlock(compass[state.facing](pos))) // Add potential sign
            }
            else if (nbt.getTag("pairz") != null) { // Container is paired with a block East/West
                pos.z = nbt.getTag("pairz") // Update the z value
                targets.push(mc.getBlock(compass[state.facing](pos))) // Add potential sign
            }
            destroyContainer(player, block) // Destroy the container
        }
        else if (nbt.getTag("text") != null) { // Check it is a container sign block
            log("Sign: " + JSON.stringify(nbt))
        }
        else {
            log("Non-Container: " + JSON.stringify(nbt))
        }
    })
}

initializeListeners()