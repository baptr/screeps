const combatant = require('role2.combatant');
const dismantler = require('role2.dismantler');
const pathing = require('util.pathing');

const OBSERVER = '5b51885c8610fd40ae72c7da';
const ATTACK = false;
const TARGET = 'W1N1';

function planApproach(roomName) {
    const obs = Game.getObjectById(OBSERVER);
    if(!obs) return [];
    obs.observeRoom(roomName);
    const room = Game.rooms[roomName];
    if(!room) return [];
    
    var towers = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_TOWER});
    towers.sort((a, b) => a.hits - b.hits);
    if(!towers.length) {
        towers = room.find(FIND_HOSTILE_STRUCTURES);
        towers.sort((a, b) => a.hits - b.hits);
    }

    //return;
    const exitGoals = _.map(room.find(FIND_EXIT), e => {return {pos: e}});
    var exit;
    var target;
    var exitCost = Infinity;
    _.forEach(towers, t => {
        // XXX cost matrix
        let ret = PathFinder.search(t.pos, exitGoals, {maxRooms: 1});
        if(!ret.incomplete && ret.cost < exitCost) {
            exit = ret.path[ret.path.length-1];
            exitCost = ret.cost;
            target = t;
        }
    })
    
    if(!target) {
        if(Game.time % 20 == 0)  console.log("Unable to pick tower to attack in", roomName);
        return [];
    }

    // Figure out which room is adjacent to that exist, form up there.
    // XXX has to be a better way to do this
    var exitDir;
    var entrancePos = new RoomPosition(exit.x, exit.y, exit.roomName);
    if(exit.x == 0) {
        exitDir = LEFT;
        entrancePos.x = 49;
    }
    if(exit.y == 0) {
        exitDir = TOP;
        entrancePos.y = 49;
    }
    if(exit.x == 49) {
        exitDir = RIGHT;
        entrancePos.x = 0;
    }
    if(exit.y == 49) {
        exitDir = BOTTOM;
        entrancePos.y = 0;
    }
    var gatherRoom = Game.map.describeExits(roomName)[exitDir];
    entrancePos.roomName = gatherRoom;
    
    if(Game.time % 20 == 0) console.log(`Attacking ${target} via ${gatherRoom} -> ${exit}. In-room cost ${exitCost}`);
    
    if(!Game.flags.Src) {
        if(Game.time % 20 == 0) console.log("No Src flag for attack planning");
        return [];
    }

    path = PathFinder.search(Game.flags.Src.pos, {pos: entrancePos, range: 10}, {maxOps: 10000}, {
        roomCallback: r => r != roomName
    });
    if(path.incomplete) {
        pathing.visPath(path.path);
        if(Game.time % 20 == 0) console.log("incomplete path to gatherPos",entrancePos,JSON.stringify(path));
        return [];
    }
    pathing.visPath(path.path);
    gatherPos = path.path[path.path.length-1]
    Game.flags.GatherPoint.setPosition(gatherPos);
    return [path, target];
}


module.exports = {
planApproach: planApproach,
test: function() {
    const target = TARGET;
    
    if(!ATTACK || Game.time%10 != 0) {
        Game.getObjectById(OBSERVER).observeRoom(target);
        return;
    }
    
    // TODO(baptr): Store this so it doesn't have to be recalculated constantly.
    var [path, tower] = planApproach(target);
    if(!path) return;
    
    // return;
    switch(Game.time % 1200) {
    case 0:
    case 400:
        dismantler.test(tower.id);
        break;
    case 800:
         _.forEach(Game.spawns, s => {combatant.spawn(s, Game.flags.GatherPoint.pos, tower.id)});
    }
    
    // TODO(baptr): If we have any already in the room (for a few ticks?), charge immediately...
    var gatherRoom = Game.flags.GatherPoint.room;
    if(gatherRoom) {
        // TODO(baptr): Wait until they're actually in range.
        var bats = gatherRoom.find(FIND_MY_CREEPS, {filter: c => c.memory.role == combatant.ROLE});
        if(bats.length > 8) {
            _.forEach(bats, c => c.memory.charge = true);
            return;
        }
        if(tower.room.find(FIND_MY_CREEPS).length > 4) {
            _.forEach(bats, c => c.memory.charge = true);
        }
    }
}
};