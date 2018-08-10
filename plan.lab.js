// Tier 1 is always base + {O,H}
// Tier 2 is always T1 + OH
// Tier 3 is always T2 + X

// Layouts...
// for ghodium:
//  ZK G  UL
// Z  K  U  L
//
// for T3:
//      T3
//    T2  X
//  T1  OH
// B  O   H

const VISUALIZE = true;
const BUILD = false;

var INVERT_REACTIONS = {};
_.forOwn(REACTIONS, (v, a) => _.forOwn(v, (c, b) => {
    INVERT_REACTIONS[c] = [a,b];
}));

// ghodium production requires a different pattern than the rest.
// easiest to hard code it.
function planGhodium(pos) {
    const room = Game.rooms[pos.roomName];
    if(!room) {
        console.log('No visiblity to plan labs in room ' + pos.roomName);
        return false
    }
    var locs = {};
    const set = function(res, x, y) {
        locs[res] = {pos: room.getPositionAt(x, y), tier: 1};
    }
    set('G', pos.x, pos.y);
    set('ZK', pos.x - 2, pos.y);
    set('UL', pos.x + 2, pos.y);
    set('Z', pos.x - 3, pos.y + 1);
    set('K', pos.x - 1, pos.y + 1);
    set('U', pos.x + 1, pos.y + 1);
    set('L', pos.x + 3, pos.y + 1);
    
    return locs;
}

function tier(res, parent) {
    switch(res) { // special cases
    case 'X':
        return 3; // only needed when making tier 3 results
    case 'OH':
        return 2; // only needed when making tier 2 results
    }
    switch(res.length) {
    case 5:
        return 3;
    case 4:
        return 2;
    case 2:
        return 1;
    case 1:
        return tier(parent, null);
    }
    return -1;
}

function plan(pos, res) {
    if(res == RESOURCE_GHODIUM) { return planGhodium(pos); }
    if(!INVERT_REACTIONS[res]) {
        console.log(`Invalid resource ${res} to plan labs`);
        return false;
    }
    const room = Game.rooms[pos.roomName];
    if(!room) {
        console.log('No ' + pos.roomName + ' visiblity for lab planning');
        return false;
    }
    
    var locs = room.memory.labs || {};
    let rP = locs[res];
    if(rP && rP.pos && pos.isEqualTo(rP.pos.x, rP.pos.y)) {
        // Already planned, just return that.
        return locs;
    }
    
    var OH = '';
    locs[res] = {pos: pos, tier: tier(res, null)};
    const place = function(res) {
        if(!INVERT_REACTIONS[res] || res == 'G') return;
        let [left, right] = INVERT_REACTIONS[res];
        let parent = locs[res];
        if(res.length == 2 && res != 'OH') {
            if(left == 'O' || left == 'H') {
                [left, right] = [right, left];
            }
            OH = right;
        } else if(res == 'OH') {
            if(OH == right) { // TODO(baptr): Safe to assume it's always right?
                [left, right] = [right, left];
            }
        }
        
        let pos = parent.pos;
        const set = function(res, x, y, parent) {
            if(res in locs) {
                // Should only happen for the common O/H between T1 and T2.
                // TODO(baptr): Yell if not O or H, or parent is OH?
                // Could move them to be in the shared spot, here...
                return;
            }
            locs[res] = {pos: room.getPositionAt(x, y), tier: tier(res, parent)};
            place(res);
        }
        set(left, pos.x - 1, pos.y + 1, res);
        set(right, pos.x + 1, pos.y + 1, res);
    };
    place(res);
    
    // Save this for runtime use (or reuse for another equivalent plan);
    room.memory.labs = locs;
    
    return locs;
}

function visualize(room, plan) {
    _.forOwn(plan, (p, r) => {
        var color;
        switch(p.tier) {
        case 0:
            color = '#ffffff'; // white
            break;
        case 1:
            color = '#00ff00'; // green
            break;
        case 2:
            color = '#0000ff'; // blue
            break;
        case 3:
            color = '#ff0000'; // red
            break;
        default:
            color = '#555555'; // grey
            break;
        }
        room.visual.text(r, p.pos, {color: color});
    });
    
}

function build(pos, res) {
    var locs = plan(pos, res);
    if(!locs) return false;
    
    const room = Game.rooms[pos.roomName];
    if(VISUALIZE) visualize(room, locs);
    
    var tiers = _.groupBy(locs, p => p.tier);
    var labsNeeded = 0;
    const labsAvail = CONTROLLER_STRUCTURES[STRUCTURE_LAB][room.controller.level]; // XXX - already built...?
    for(var tLim = 1; tLim < 4; tLim++) {
        labsNeeded += tiers[tLim].length;
        if(labsNeeded > labsAvail) break;
    }
    if(tLim == 1) {
        if(Game.time % 100 == 0) console.log(room.name + ' control level too low to build labs' + ` need ${labsNeeded}/${labsAvail}`);
        return false;
    }
    _.forEach(locs, (p, r) => {
        // RoomPositions don't round-trip through memory. :-/
        let p_ = new RoomPosition(p.pos.x, p.pos.y, p.pos.roomName);
        if(!p.struct) {
            var st = _.find(p_.lookFor(LOOK_STRUCTURES), s => s.structureType == STRUCTURE_LAB);
            if(st) p.struct = st.id;
        } else { return }
        if(p.tier >= tLim) { return }
        if(BUILD) { 
            room.createConstructionSite(p_, STRUCTURE_LAB);
        } else {
            room.visual.circle(p_, {opacity: 0.5});
        }
    });
}

function planMiners(room) {
    var labs = room.memory.labs;
    if(!labs) return;
    _.forEach(labs, (l, r) => {
        var lab = Game.getObjectById(l.struct);
        if(!lab) return;
        // XXX re-purpose the miner?
        if(lab.mineralAmount >= lab.mineralCapacity) return;
        
        // TODO(baptr): handle ghodium
        if(r.length != 1) {
            var [left, right] = INVERT_REACTIONS[r];
            var lLab = Game.getObjectById(labs[left].struct);
            var rLab = Game.getObjectById(labs[right].struct);
            if(!lLab || !rLab) {
                console.log("Couldn't find sub labs for " + r);
                return;
            }
            lab.runReaction(lLab, rLab);
            return;
        }
        var src = Game.getObjectById(l.src);
        if(!src) {
            // Find one
            // TODO(baptr): Memoize?
            _.forEach(Game.rooms, (rm, n) => {
                if(!rm.controller.my) return;
                
                var m = rm.find(FIND_MINERALS, m => m.mineralType == r)[0];
                if(!m) return;
                if(!m.pos.lookFor(LOOK_STRUCTURES, s => s.structureType == STRUCTURE_EXTRACTOR).length) return;
                src = m;
                return false;
            });
            if(src) {
                l.src = src.id;
            } else {
                console.log(`No src for ${r}`);
                return;
            }
        }
        
        var creep = Game.getObjectById(l.miner);
        if(!creep) {
            // spawn one near the source
            // console.log(`No creep for ${r}`);
            src.room.memory.needMiner = {src: src.id, dest: lab.id};
        }
    })
}

module.exports = {
  planGhodium: planGhodium,
  plan: plan,
  test: function() {
    //build(Game.rooms.W4N8.getPositionAt(20, 26), RESOURCE_GHODIUM);
    if(Game.time%10 == 0) {
        build(Game.rooms.W5N8.getPositionAt(38, 22), RESOURCE_CATALYZED_KEANIUM_ALKALIDE);
        planMiners(Game.rooms.W5N8);
    }
  }
};