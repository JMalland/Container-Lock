ll.registerPlugin("Container Lock", "Allow for players to lock chests and other containers using signs.", [1,0,0], {"Author": "JTM"})

function useItemOn(player, item, block) {
    if (block.name != "minecraft:sign") {
        return // Quit the function
    }
    // Check if hanging, not free-standing
    // Figure out sign facing using Nbt states
    // Based on facing, test if block behind is container block
}

function initializeListeners() {
    mc.listen("onUseItemOn", useItemOn) // Listen for players placing blocks
}
