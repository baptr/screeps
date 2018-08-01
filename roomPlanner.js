var bootstrapper = require('role2.bootstrapper');
var dropHarvester = require('role2.dropHarvester');
var pathing = require('pathing');
var roleDefender = require('role.defender');
//var util = require('util');

/* TODOs:
 - Harvest minerals.
   - Return them to base?
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

// return the number of walkable spaces adjacent to the provided room position.
function spacesNear(pos, range = 1) {
    var room = Game.rooms[pos.roomName];
    var area = room.lookAtArea(pos.y-range, pos.x-range, pos.y+range, pos.x+range, false);
    var free = [];
    for(var y = pos.y-range; y <= pos.y+range; y++) {
        for(var x = pos.x-range; x <= pos.x+range; x++) {
            if(!area[y][x]) {
                console.log(`spacesNear(${pos}): missing ${x}, ${y}`);
                continue;
            }
            var blocked = false;
            for(var i = 0; i < area[y][x].length; i++) {
                var o = area[y][x][i];
                var t = o.type;
                switch(t) {
                case LOOK_STRUCTURES:
                case LOOK_CONSTRUCTION_SITES:
                    t = o[t].structureType;
                    break;
                case LOOK_TERRAIN:
                    t = o[t];
                    break;
                }
                
                if(OBSTACLE_OBJECT_TYPES.includes(t)) {
                    blocked = true;
                    room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#ff0000", opacity: 0.25});
                    break;
                }
            }
            if(!blocked) {
                room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#00ff00", opacity: 0.25});
                var p = room.getPositionAt(x, y);
                if(p) { // Ignore out of bounds.
                    free.push(p);
                }
            }
        }
    }
    // TOOD(baptr): Sort by linear distance from the target?
    return free;
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
function planBuilding(pos, type) {
    const room = Game.rooms[pos.roomName];
    if(!room) {
        console.log("Invalid room in planBuilding pos: "+pos);
        return;
    }
    var [numBld, maxBld] = numBuilding(room, type);
    if(numBld >= maxBld) { return; }

    // TODO(baptr): Should really test path distance from sources, not linear
    // distance from spawn...
    for(var radius = 1; radius < 7; radius++) { // TODO(baptr): memoize minumum
        for(var y = pos.y - radius; y <= pos.y + radius; y+=2) {
            for(var x = pos.x - radius; x <= pos.x + radius; x+=2) {
                room.visual.rect(x-0.5, y-0.5, 1, 1);
                if(room.getPositionAt(x, y).findInRange(FIND_SOURCES, 1).length) {
                    // TOO CLOSE!
                    room.visual.rect(x-0.5, y-0.5, 1, 1, {fill: "#cc0000"});
                    continue;
                }
                const ret = room.createConstructionSite(x, y, type);
                switch(ret) {
                case OK:
                    console.log(`Scheduled ${type} @ (${x}, ${y})`);
                    numBld++;
                    if(numBld >= maxBld) { return; }
                    continue;
                case ERR_FULL:
                    console.log(`Too many construction sites in ${room}`);
                    return;
                case ERR_RCL_NOT_ENOUGH:
                    // Shouldn't happen
                    console.log(`RCL_NOT_ENOUGH trying to add a ${type} for ${numBld} < ${maxBld}`);
                    return;
                case ERR_INVALID_TARGET:
                    continue;
                default:
                    console.log(`Create ${numBld} < ${maxBld} @ (${x}, ${y}) = ${ret}`);
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

module.exports = {
    run: function(room) {
        var spawn = room.find(FIND_MY_SPAWNS)[0];
        if(!spawn) {
            if(Game.time % 100 == 0) console.log("Awaiting spawn in "+room.name);
            return;
        }
        if(room.find(FIND_HOSTILE_CREEPS).length > 0) {
            roleDefender.spawn(spawn, {});
            return;
        }
        // TODO(baptr): Only do this when room control level changes,
        // or scale out the time further.
        // TOOD(baptr): Should also splay these between rooms to smooth CPU
        // spikes.
        if(Game.time % 1000 == 0) {
            planBuilding(spawn.pos, STRUCTURE_EXTENSION);
            planBuilding(spawn.pos, STRUCTURE_TOWER);
            planRoads(room);
            planMining(room);
        }
        //spacesNear(spawn.pos, 40);
        
        var creeps = room.find(FIND_MY_CREEPS);
        var kinds = _.groupBy(creeps, c => c.memory.role);
        // var numRole = r => (kinds[r] || []).length;
        
        if(bootstrapper.spawnCondition(spawn, kinds)) {
            bootstrapper.spawn(spawn);
        }
        if(Game.time % 100 == 0) { // bleh
            dropHarvester.spawn(spawn);
        }
    },
    spacesNear: spacesNear,
};