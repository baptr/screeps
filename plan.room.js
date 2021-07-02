const bootstrapper = require('role2.bootstrapper');
const dropHarvester = require('role2.dropHarvester');
const roleDefender = require('role.defender');
const builder = require('role2.builder');
const miner = require('role2.miner');
const bob = require('role.bob');
const hauler = require('role2.hauler');
const storeUpgrader = require('role2.storeUpgrader');
const remoteHarvester = require('role2.remoteHarvester');

const splay = require('util.splay');
const pathing = require('util.pathing');

/* TODOs:
 - Add additional spawners at some point to avoid spawn time bottlenecks.
   - Make them usable.
 - Tune spawn energy thresholds, since it's hard to use all energy for one spawn.
 - Work on combat.
 - Extend bootstrappers to be more carry-heavy.
 - Save up before spawning a bootstrapper if available < capacity and there are other delivery drones around.
 - Better tune bootstrapper -> dropHarvester spawn strategy.
*/

const ROAD_DESTS = [STRUCTURE_SPAWN, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR];

function planRoads(room) {
    // Check how much roads would improve routes between high-traffic nodes.
    var sources = room.find(FIND_SOURCES);
    var dests = room.find(FIND_STRUCTURES, {
        filter: s => ROAD_DESTS.includes(s.structureType),
    });
    
    const pathMatrix = pathing.roomCallback(room.name);
    // pairwise among all of them is probably best...
    var all = sources.concat(dests);
    var ret = [];
    for(var i = 0; i < all.length; i++) {
        for(var j = i+1; j < all.length; j++) {
            // TODO(baptr): Plan roads after each pass, and update the matrix
            // accordingly.
            var from = all[i];
            var to = all[j];
            if(from instanceof StructureController) {
                [from, to] = [to, from];
            }
            ret.push(...pathing.swampCheck(from.pos, to.pos, pathMatrix));
        }
    }
    _.forEach(ret, p => room.createConstructionSite(p, STRUCTURE_ROAD));
}

// return the current and max number of structures of the given type in the
// provided room.
function numBuilding(room, type) {
    const maxType = CONTROLLER_STRUCTURES[type][room.controller.level];
    const existing = room.find(FIND_STRUCTURES, {filter: s => s.structureType == type});
    const pending = room.find(FIND_MY_CONSTRUCTION_SITES, {filter: s => s.structureType == type});
    
    _.forEach(existing, e => room.visual.rect(e.pos.x-0.5, e.pos.y-0.5, 1, 1, {fill: "#0000aa"}));
    _.forEach(pending, e => room.visual.rect(e.pos.x-0.5, e.pos.y-0.5, 1, 1, {fill: "#00aa00"}));
    
    return [existing.length + pending.length, maxType];
}

// try to grow extensions in a diamond pattern between the spawn and nearest
// source with space.
// - Leave a gap around the source to make sure harvesters can make it.
// - Maybe leave a good path there (best path from spawn?)
// - Or maybe diamond around the sources themselves?
// TODO(baptr): Memoize this in room memory until controller level changes.
function planBuildings(pos, types) {
    const room = Game.rooms[pos.roomName];
    if(!room) {
        console.log("Invalid room in planBuilding pos: "+pos);
        return;
    }
    
    var queue = [];
    _.forEach(types, t => {
        var [numBld, maxBld] = numBuilding(room, t);
        if(numBld >= maxBld) return;
        queue.push(...Array(maxBld-numBld).fill(t));
    })
    var type = queue.shift();
    if(!type) { return; }

    // TODO(baptr): Should really test path distance from sources, not linear
    // distance from spawn...
    for(var radius = 1; radius < 7; radius++) { // TODO(baptr): memoize minumum
        for(var y = pos.y - radius; y <= pos.y + radius; y+=2) {
            for(var x = pos.x - radius; x <= pos.x + radius; x+=2) {
                room.visual.rect(x-0.5, y-0.5, 1, 1);
                if(room.getPositionAt(x, y).findInRange(FIND_SOURCES, 2).length) {
                    // TOO CLOSE!
                    room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#cc0000"});
                    continue;
                }
                const ret = room.createConstructionSite(x, y, type);
                switch(ret) {
                case OK:
                    console.log(`Scheduled ${type} @ (${x}, ${y})`);
                    type = queue.shift();
                    if(!type) { return; }
                    continue;
                case ERR_FULL:
                    console.log(`Too many construction sites in ${room}`);
                    return;
                case ERR_RCL_NOT_ENOUGH:
                    // Shouldn't happen
                    console.log(`RCL_NOT_ENOUGH trying to add a ${type}`);
                    return;
                case ERR_INVALID_TARGET:
                    continue;
                default:
                    console.log(`Create ${type} @ (${x}, ${y}) = ${ret}`);
                }
            }
        }
    }
}

function planMining(room) {
    var [numExt, maxExt] = numBuilding(room, STRUCTURE_EXTRACTOR);
    // TODO(baptr): Do more than just placing extractors.
    if(numExt >= maxExt) { return }
    const minerals = room.find(FIND_MINERALS);
    _.forEach(minerals, m => {
        room.createConstructionSite(m.pos, STRUCTURE_EXTRACTOR);
    });
}

// XXX make this less annoying to apply
function countCPU(id, f) {
    const start = Game.cpu.getUsed();
    const ret = f();
    const end = Game.cpu.getUsed();
    console.log(`CPU for ${id}: ${end-start}`);
    return ret;
}

module.exports = {
run: function(room) {
    if(!room) {
        if((Game.time/40) % 10 == 0) console.log("No room provided to planner!");
        return;
    }
    var spawns = room.find(FIND_MY_SPAWNS, {filter: s => s.isActive});
    if(!spawns.length) {
        if((Game.time/40) % 10 == 0) console.log("Awaiting spawn in", room.name);
        return;
    }
    var spawn = _.find(spawns, s => !s.spawning);
    if(!spawn) { return }
    var hostiles = room.find(FIND_HOSTILE_CREEPS, {filter: c => {
        var body = _.groupBy(c.body, 'type');
        if(body[ATTACK] || body[RANGED_ATTACK] || body[CLAIM]) return true;
        return false;
    }});
    if(hostiles.length > 0) {
        if(Game.time % 20 == 0) console.log(`${room} under attack: ${hostiles}`);
        roleDefender.spawn(spawn, {});
        return;
    }
    // TODO(baptr): Only do this when room control level changes,
    // or scale out the time further.
    // XXX just splay this instead of the whole room?
    if(room.controller.level > (room.memory.level || 0) || splay.isTurn('room', room.name, Game.time/500)) {
        planBuildings(spawn.pos, [STRUCTURE_EXTENSION, STRUCTURE_TOWER]);
        planRoads(room);
        planMining(room);
        room.memory.level = room.controller.level;
    }
    
    _.forEach(spawns, s => {
        // TOOD(baptr): Let the spawn functions pick spawn so they don't have to 
        // recalculate all the room stuff.
        if(!s.spawning) spawnCreeps(s, room);
    });
},
planRoads,
};

// Figure out |limit| roles that are worth trying to spawn.
function couldSpawn(room, limit=1) {
    const creeps = room.find(FIND_MY_CREEPS);
    var kinds = _.groupBy(creeps, c => c.memory.role);
    const numRole = r => (kinds[r] || []).length;
}

// TODO(baptr): These checks will almost always try to spawn two of the same
// creep if there are multiple spawns in a room. None of the enqueued changes
// effect the checks for the next spawner in the caller's loop...
function spawnCreeps(spawn, room) {
    var creeps = room.find(FIND_MY_CREEPS);
    var kinds = _.groupBy(creeps, c => c.memory.role);
    var numRole = r => (kinds[r] || []).length;
    
    // TODO(baptr): Make this more dynamic based on available harvest spots.
    if(numRole(bootstrapper.ROLE) > 3 && numRole(dropHarvester.ROLE) < 2) {
        dropHarvester.spawn(spawn);
    }
    if(spawn.spawning) return;
    
    // XXX super hack
    if(Game.time % 1500 == 840 && spawn.room.name == 'E16N27') {
        if(remoteHarvester.spawn(spawn, 'E15N27') == OK) return;
    }
    if(spawn.spawning) return;
    
    if(bootstrapper.spawnCondition(room, numRole(bootstrapper.ROLE))) {
        bootstrapper.spawn(spawn);
    }
    if(spawn.spawning) return;
    
    // XXX If this stops running every tick, this sort of delay tactic will fail horribly.
    if(Game.time % 100 == 0) { // bleh
        dropHarvester.spawn(spawn);
    }
    if(spawn.spawning) return;
    
    // RCL 2 seems early enough to start trying to use storeUpgraders
    if(room.energyAvailable == room.energyCapacityAvailable && room.energyAvailable > 500) {
        if(hauler.spawnCondition(room, numRole(hauler.ROLE))) {
            hauler.spawn(spawn);
        }
        if(spawn.spawning) return;
        
        if(storeUpgrader.spawnCondition(room, numRole(storeUpgrader.ROLE))) {
            storeUpgrader.spawn(spawn);
        }
        if(spawn.spawning) return;
        
        if(builder.spawnCondition(room, numRole(builder.ROLE))) {
            builder.spawn(spawn);
        }
        if(spawn.spawning) return;
    }
    
    var minerNeeded = room.memory.needMiner;
    if(minerNeeded) {
        // console.log("Need miner in " + room.name + " " + JSON.stringify(minerNeeded));
        if(miner.spawn(spawn, minerNeeded) == OK) {
            // Far from perfect since this will be re-written until the lab is
            // full, but will eventually stop spawns.
            // TODO(baptr): improve
            delete room.memory.needMiner;
        }
    }
    if(spawn.spawning) return;
    
    var bobNeeded = room.memory.needBob;
    if(bobNeeded && Game.time % 100 == 32) {
        //console.log("bobNeeded:",JSON.stringify(bobNeeded));
        //return;
        if(bob.spawn(spawn, bobNeeded.res, bobNeeded.src, bobNeeded.dest) == OK) {
            delete room.memory.needBob;
        }
    }
}
