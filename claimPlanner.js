const claimer = require('role.claimer');
const builder = require('role.builder');
const relocater = require('role.relocater');
const bootstrapper = require('role2.bootstrapper');

const VISUALIZE = true;
const BOOTSTRAP = false;

function run(roomName) {
    const obs = Game.getObjectById(module.exports.observer);
    if(!obs) {
        console.log('Unable to use observer for claim planning');
    }
    var ret = obs.observeRoom(roomName);
    if(ret != OK) {
        console.log(`Unable to observe ${roomName} from ${obs}: ${ret}`);
    }
    const room = Game.rooms[roomName];
    if(!room) {
        // not yet visible, try again next tick.
        console.log(`No visibility into claim target ${roomName}, trying next tick...`);
        return;
    }
    const ctrl = room.controller;
    
    // Pick a src spawn in a high enough (?) level room that's as close as
    // possible to the target.
    var [spawn, path] = pickSpawn(ctrl.pos);
    // Is it actually worth the effort to (re)use the path? Or just spawn a few
    // relocater->bootstrappers and be done with it?
    if(BOOTSTRAP && !ctrl.my) {
        if(claimer.spawn(spawn, roomName) == OK) {
            return;
        }
    }
    if(BOOTSTRAP && ctrl.my) {
        if(room.find(FIND_MY_SPAWNS) || room.find(FIND_MY_CONSTRUCTION_SITES)) {
            // already planned, just send in some bootstrappers to help out
            // XXX when do we stop?
            if(room.find(FIND_MY_CREEPS).length > 3) return;
            if(spawn.spawning) return;
            // TODO(baptr): Avoid a thundering herd so the bodies are better.
            var body = builder.mkBody(spawn.room.energyAvailable);
            var ret = spawn.spawnCreep(body, `relo-builder-${roomName}-${Game.time}`, {memory: relocater.setMem({}, roomName, 'bootstrapper')});
            if(ret == OK) return;
            console.log(`Tried to spawn relo builder for ${roomName}: ${ret}`);
        } else {
            if(Game.time % 10) {
                console.log("No spawn planned for "+roomName);
            }
            // XXX figure out a place for a spawn? (via roomPlanner?)
            // look for a flag?
            // place the construction site manually?
        }
    }
}

// TODO(baptr): Consider Game.map.findRoute...
// - easier to filter enemy rooms
function pickSpawn(dstPos) {
    var goals = _.map(Game.spawns, s => {
        // TODO(baptr): Filter for rooms with a lot of energy?
        return {pos: s.pos, range: 1};
    });
    var pathRes = PathFinder.search(dstPos, goals, {maxCost: CREEP_CLAIM_LIFE_TIME - 50, maxOps: 20000});
    var path = pathRes.path;
    path.reverse();
    if(VISUALIZE) visPath(path);
    var spawn = path[0].findClosestByRange(FIND_MY_SPAWNS);
    if(!spawn) {
        console.log('No spawn near calculated path');
        return [];
    }
    return [spawn, pathRes];
}

function visPath(path) {
    var roomVis;
    var lastRoom;
    for(let i = 1; i < path.length; i++) {
        let prev = path[i-1];
        let cur = path[i];
        if(prev.roomName != cur.roomName) continue;
        if(cur.roomName != lastRoom) {
            lastRoom = cur.roomName;
            roomVis = new RoomVisual(cur.roomName);
        }
        roomVis.line(prev, cur);
    }
}

// TODOs:
// - figure out a better way to use observers

module.exports = {
target: 'W8N7',
observer: '5b51885c8610fd40ae72c7da',
run: run,
pickSpawn: pickSpawn,
test: function() {
    //run(module.exports.target);
}
};