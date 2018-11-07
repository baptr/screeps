const claimer = require('role.claimer');
const builder = require('role2.builder');
const relocater = require('role.relocater');
const bootstrapper = require('role2.bootstrapper');

const VISUALIZE = true;
const BOOTSTRAP = true;

function run(claimFlag) {
    var spawnPos = claimFlag.pos;
    var roomName = spawnPos.roomName;
    const obs = Game.getObjectById(module.exports.observer);
    if(obs) {
        var ret = obs.observeRoom(roomName);
        if(ret != OK) {
            console.log(`Unable to observe ${roomName} from ${obs}: ${ret}`);
        }
    } else {
        // TODO(baptr): Spawn a scout to send there instead
        // (if it's not already visible...)
    }
    const room = Game.rooms[roomName];
    if(!room) {
        // TODO(baptr): If this happens multiple times, the observer msut be in
        // use elsewhere...
        console.log(`No visibility into claim target ${roomName}, trying next tick...`);
        return;
    }
    const ctrl = room.controller;
    
    // Pick a src spawn in a high enough (?) level room that's as close as
    // possible to the target.
    var [spawn, path] = pickSpawn(ctrl.pos);
    // Is it actually worth the effort to (re)use the path? Or just spawn a few
    // relocater->bootstrappers and be done with it?
    // TODO(baptr): Don't try to spawn another while the first is still travelling.
    if(BOOTSTRAP && !ctrl.my) {
        if(claimer.spawn(spawn, roomName) == OK) {
            return;
        }
    }
    if(BOOTSTRAP && ctrl.my) {
        if(room.find(FIND_MY_SPAWNS).length || room.find(FIND_MY_CONSTRUCTION_SITES).length) {
            if(room.energyCapacityAvailable > 700) {
                console.log("Initial bootstrapping of",roomName,"complete");
                claimFlag.remove();
                return;
            }
            // already planned, just send in some bootstrappers to help out
            // TODO(baptr): This doesn't keep sending bigger ones once the room
            // is able to build its own, which was kind of the point.
            if(room.find(FIND_MY_CREEPS).length > 7) return;
            if(spawn.spawning) return;
            // TODO(baptr): Avoid a thundering herd so the bodies are better.
            var body = builder.mkBody(spawn.room.energyAvailable);
            if(!body) return;
            const name = `relo-builder-${roomName}-${Game.time}`;
            var ret = spawn.spawnCreep(body, name, {
                memory: relocater.setMem({}, roomName, 'bootstrapper'),
            });
            if(ret == OK) return;
            console.log(`Failed to spawn ${name}: ${ret}`);
        } else {
            // TODO figure out a place for it via roomPlanner?
            var ret = room.createConstructionSite(spawnPos.x, spawnPos.y, STRUCTURE_SPAWN, 'Spawn'+roomName);
            console.log(`Placing construction site at ${spawnPos} in ${roomName}: ${ret}`);
        }
    }
}

// TODO(baptr): Consider Game.map.findRoute...
// - easier to filter enemy rooms
function pickSpawn(dstPos) {
    var goals = _.map(_.filter(Game.spawns, s => s.room.energyCapacityAvailable > 1000), s => {
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
observer: '5b51885c8610fd40ae72c7da',
run: run,
pickSpawn: pickSpawn,
test: function() {
    var target = Game.flags.Claim;
    if(target) {
        run(target);
    }
}
};