module.exports = {
    // spawn a defender creep using as much of the available energy as possible.
    spawn: function(spawn, mem) {
       var available = spawn.room.energyAvailable;
       const rangedCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
       const toughCost = BODYPART_COST[TOUGH] + BODYPART_COST[MOVE];
       const healCost = BODYPART_COST[HEAL] + BODYPART_COST[MOVE];
       const meleeCost = BODYPART_COST[ATTACK] + BODYPART_COST[MOVE]; // TODO factor in
       
       var body = [];
       if(available > 5*rangedCost) {
           body.push(HEAL, MOVE);
           available -= healCost;
       }
       if(available > 4*rangedCost) {
           body.push(TOUGH, MOVE);
           available -= toughCost;
       }
       while(available > rangedCost) {
           body.push(RANGED_ATTACK, MOVE)
           available -= rangedCost;
       }
       while(available > toughCost) {
           body.push(TOUGH, MOVE);
           available -= toughCost;
       }
       // body cost is a reasonable sort for TOUGH < MOVE < ATTACK
       // TODO(baptr): Though MOVE should be spent first, probably...
       body.sort((a,b) => BODYPART_COST[a] - BODYPART_COST[b]);
       mem.role = 'defender';
       spawn.spawnCreep(body, 'defender_'+Game.time, {memory: mem});
    },
    run: function(creep) {
        if(creep.memory.targetRoom && creep.memory.targetRoom != creep.room.name) {
            var dir = creep.room.findExitTo(creep.memory.targetRoom);
            var exit = creep.pos.findClosestByPath(dir);
            creep.moveTo(exit);
        }
        
        var enemy = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if(!enemy) { return false }
        creep.say('Yarrrrr', true);
        if(creep.rangedAttack(enemy) == ERR_NOT_IN_RANGE) {
            creep.moveTo(enemy);
        }
        
        if(creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }
    }
};