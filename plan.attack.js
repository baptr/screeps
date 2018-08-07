const combatant = require('role2.combatant');
const pathing = require('pathing');

const OBSERVER = '5b51885c8610fd40ae72c7da';

function planAttack(roomName) {
    const obs = Game.getObjectById(OBSERVER);
    obs.observeRoom(roomName);
    const room = Game.rooms[roomName];
    if(!room) return;
    
    var towers = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_TOWER});
    towers.sort((a, b) => a.hits - b.hits);

    /*var exit;
    _.forEach(towers, t => {
        let exit_ = t.pos.findClosestByPath(FIND_EXIT);
        if(exit && exit_.)
    })*/
    
    // TODO(baptr): Pick one closest to an exit.
    var target = towers[0];
    if(!target) return; // XXX pick some fallback
    
    var exit = target.pos.findClosestByPath(FIND_EXIT);
    if(!exit) return; // Going to have to break down walls or something.
    
    // Figure out which room is adjacent to that exist, form up there.
    // XXX has to be a better way to do this
    var exitDir;
    if(exit.x == 0) exitDir = LEFT;
    if(exit.y == 0) exitDir = TOP;
    if(exit.x == 49) exitDir = RIGHT;
    if(exit.y == 49) exitDir = BOTTOM;
    var gatherRoom = Game.map.describeExits(roomName)[exitDir];
    
    // console.log("Attacking " + target + " via " + gatherRoom);
    
    // TODO(baptr): No guarantee this is walkable or can reach the exit...
    var gatherPos = new RoomPosition(25, 25, gatherRoom);

    path = PathFinder.search(Game.flags.Src.pos, {pos: gatherPos, range: 10}, {
        roomCallback: r => r != roomName
    });
    pathing.visPath(path.path);
    gatherPos = path.path[path.path.length-1]
    Game.flags.GatherPoint.setPosition(gatherPos);
    return path;
}

module.exports = {
planAttack: planAttack,
test: function() {
    return;
    Game.getObjectById(OBSERVER).observeRoom('W9N9');
    
    planAttack('W9N9');
    if(Game.time % 20 == 3) _.forEach(Game.spawns, s => combatant.spawn(s, Game.flags.GatherPoint.pos));
    
    var gatherRoom = Game.flags.GatherPoint.room;
    if(gatherRoom) {
        var bats = gatherRoom.find(FIND_MY_CREEPS, {filter: c => c.memory.role == combatant.ROLE});
        if(bats.length > 6) {
            _.forEach(bats, c => c.memory.charge = true);
        }
        
    }
}
};