module.exports = {
    // spawn a defender creep using as much of the available energy as possible.
    spawn: function(spawn, mem={}) {
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
       if(body.length == 0) {
           // Can't actually afford any ranged attack. Could try without a MOVE
           // Or fall back on ATTACK body. But for now, just wait.
           return false;
       }
       while(available > toughCost) {
           body.push(TOUGH, MOVE);
           available -= toughCost;
       }
       if(body.length > MAX_CREEP_SIZE) {
           body = body.slice(0, MAX_CREEP_SIZE);
       }
       // body cost is a reasonable sort for TOUGH < MOVE < ATTACK
       // TODO(baptr): Though MOVE should be spent first, probably...
       body.sort((a,b) => BODYPART_COST[a] - BODYPART_COST[b]);
       mem.role = 'defender';
       return spawn.spawnCreep(body, 'defender_'+Game.time, {memory: mem});
    },
    run: function(creep) {
        if(creep.memory.targetRoom && creep.memory.targetRoom != creep.room.name) {
            var dir = creep.room.findExitTo(creep.memory.targetRoom);
            var exit = creep.pos.findClosestByPath(dir);
            creep.moveTo(exit);
            return;
        }
        
        var enemy = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if(!enemy) {
            spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if(!spawn) {
                console.log(`${creep.name} suiciding`);
                creep.say("No more!");
                creep.suicide();
                return false;
            }
            console.log(`${creep.name} recycling`);
            creep.say("Back to dust!");
            creep.moveTo(spawn);
            spawn.recycleCreep(creep);
            return false;
        }
        creep.say('Yarrrrr', true);
        if(creep.rangedAttack(enemy) == ERR_NOT_IN_RANGE) {
            creep.moveTo(enemy);
        }
        
        if(creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }
    }
};