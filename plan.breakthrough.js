var obstacle = {'rampart': true}
// This ignores creeps, but that's probably OK...??
_.forEach(OBSTACLE_OBJECT_TYPES, o => {obstacle[o] = true});

// hits/DISMANTLE_POWER/WORK = dismantle ticks
// say 5+ WORK, that's hits/250
// - 20 ticks for a spawn
// - 12 ticks for a tower
// - 1,200 ticks for a maxed out lvl 2 rampart...
// - 1,200,000 ticks for a maxed out lvl 8 rampart.....
// ~1000 ticks might be doable eventually, but anything around there is
// probably nuke territory.
const DISMANTLE_PER_TICK = 5 * DISMANTLE_POWER; // ~5 WORK lower bound. Could be 7+ and ~3 creeps...

// Try to map down to 5-250 nicely
// 1-100 ticks -> 5-105 cost
// 101-1500 ticks -> 106-250 cost
const BASE_WALL_COST = 5;
const LINEAR_MAX_TICKS = 100;
const MAX_PASSABLE_TICKS = 1500;
const HIGH_COST_RATIO = MAX_PASSABLE_TICKS / (250-LINEAR_MAX_TICKS); // 10
const MAX_PASSABLE_HITS = MAX_PASSABLE_TICKS * DISMANTLE_PER_TICK;
    
module.exports = {
proc: function(room) {
    // XXX only do all of this if there isn't a trivial path.
    const structs = room.find(FIND_STRUCTURES);
    const maxHits = _.max(_.map(_.filter(structs, s => obstacle[s.structureType] && s.hits <= PASSABLE_HITS), s => s.hits)) || 1;
    
    var matrix = new Pathfinder.CostMatrix();
    _.forEach(structs, s => {
        if(!obstacle[s.structureType]) return;
        var cost = s.hits / DISMANTLE_PER_TICK;
        if(s.hits > PASSABLE_HITS) {
            cost = 255; // another 5 is added later, but it feels weird to leave it off.
        } else if cost > LINEAR_MAX_TICKS {
            cost = cost/HIGH_COST_RATIO + LINEAR_MAX_TICKS;
        }
        matrix.set(s.pos.x, s.pos.y, BASE_WALL_COST+cost);
    });
}
};