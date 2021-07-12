const BodyBuilder = require('util.bodybuilder');

ROLE = "delivery";
module.exports = {
spawn: function(spawn) {
   // only carry+move
   // only spawn if room has a lot of sitting energy
    const energyAvailable = spawn.room.energyAvailable;
    // if(energyAvailable < MIN_COST*2 || spawn.spawning) { return false; }
    
    var builder = new BodyBuilder([CARRY, CARRY, MOVE, MOVE], energyAvailable);
    const body = builder.extend([CARRY, MOVE], limit=8);
    
    spawn.spawnCreep(body, `${ROLE}-${spawn.name}-${Game.time}`, {memory: {
        role: ROLE,
        filling: true,
        cost: body.cost,
    }});
},
run: function(creep) {
    if(creep.carry.energy == 0) creep.memory.filling = true;
    if(creep.memory.filling) {
        fill(creep);
    }
    if(!creep.memory.filling) {
        deliver(creep);
    }
},
ROLE,
};

function fill(creep) {
    var src = Game.getObjectById(creep.memory.src);
    if(src && src.store && src.store.energy < 20) src = null; 
    if(!src) { // find one
        src = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {filter:
                r => r.resourceType == RESOURCE_ENERGY && r.amount > 20});
        if(!src) {
            src = creep.pos.findClosestByPath(FIND_STRUCTURES, {filter:
                s => s.structureType == STRUCTURE_STORAGE && s.store.energy > 20});
        }
        if(!src) {
            if(creep.carry.energy > 0) creep.memory.filling = false;
            return ERR_NOT_FOUND;
        }
        creep.memory.src = src.id;
    }
    const srcDist = creep.pos.getRangeTo(src);
    if(srcDist > 1) {
        creep.moveTo(src);
    }
    if(srcDist <= 1) {
        var avail;
        var ret;
        if(src instanceof Resource) {
            avail = src.amount;
            ret = creep.pickup(src);
        } else {
            avail = src.store.energy;
            ret = creep.withdraw(src, RESOURCE_ENERGY);
        }
        if(creep.carry.energy + avail >= creep.carryCapacity) {
            creep.memory.filling = false;
        }
    } else {
        return ERR_NOT_IN_RANGE;
    }
}

function deliver(creep) {
  let dst = Game.getObjectById(creep.memory.dest);
  if(dst && dst.store.getFreeCapacity() < 50) dst = null;
  if(!dst) {
    dst = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: s => {
      if(s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) {
        return s.energy < s.energyCapacity;
      }
      return false;
    }})
    if(!dst) {
      dst = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => {
        if(c.id == creep.id) return false;
        // TODO(baptr): Figure out how to identify creeps that need energy.
        return c.store.getFreeCapacity() > 20;
      }});
    }
    if(!dst) {
      if(creep.carry.energy < creep.carryCapacity) {
        creep.memory.filling = true;
      }
      return ERR_NOT_FOUND;
    }
    creep.memory.dest = dst.id;
  }
  const dist = creep.pos.getRangeTo(dst);
  if(dist >= 1) {
    creep.moveTo(dst);
  }
  if(dist <= 1) {
    var dstSpace = 0;
    if(dst instanceof Creep) {
      dstSpace = dst.carryCapacity - _.sum(dst.carry);
    } else {
      dstSpace = dst.storeCapacity - _.sum(dst.store);
    }
    if(creep.transfer(dst, RESOURCE_ENERGY) == OK) {
      creep.memory.delivered += Math.min(dstSpace, creep.carry.energy);
    }
  }
}
