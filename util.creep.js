const recycle = require('role2.recycle');

function bodyCost(body) {
    return _.sum(body, p => BODYPART_COST[p.type || p]);
}

function renewCost(creep) {
    return Math.ceil(bodyCost(creep.body)/2.5/creep.body.length);
}

module.exports = {
bodyCost,
renewCost,
bodyPower: function(creep, type, mult) {
  let out = 0;
  for(const b of creep.body) {
    if(b.hits == 0) continue;
    if(b.type != type) continue;
    out += mult;
  }
  return out;
},
hasBody: function(creep, type) {
    var body = _.groupBy(creep.body, 'type');
    return body[type];
},
creepReport: function(roomName) {
    const room = Game.rooms[roomName];
    if(!room) {
        console.log(`No visibility into ${roomName}`);
        return false;
    }
    var creeps = room.find(FIND_CREEPS);
    console.log(`${roomName} has ${creeps.length} total creeps`);
    var kinds = _.groupBy(creeps, c => c.memory.role);
    _.forEach(kinds, (v, k) => {
        console.log(`${k}: ${v.length}`);
    });
},
recycle: function(creep) {
    return recycle.convert(creep);
},
track: function(creep, action, ret = OK) {
  if(creep.memory.life && ret == OK) {
      creep.memory.life[action] = (creep.memory.life[action]+1) || 1;
  }
  return ret;
},
renew: function(creep, start=100, stop=600) {
    // It's generally slightly more expensive to renew a creep than spawn it
    // fresh
    if(creep.ticksToLive < start && !creep.memory.renew) {
        var spawns = creep.room.find(FIND_MY_SPAWNS);
        _.forEach(spawns, s => {
            if(s.spawning) return;
            if(creep.pos.inRangeTo(s, 10)) {
                const cost = renewCost(creep);
                const benefit = Math.floor(600/creep.body.length);
                console.log(`${creep.name} trying to renew: +${benefit}t/${cost}e`);
                creep.memory.renew = s.id;
                return false;
            }
        });
    }
    if(creep.memory.renew) {
        if(creep.ticksToLive > stop) {
            delete creep.memory.renew;
        }
        var spawn = Game.getObjectById(creep.memory.renew);
        if(spawn) {
            let ret = spawn.renewCreep(creep);
            switch(ret) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(spawn);
                break;
            case ERR_NOT_ENOUGH_ENERGY:
                // TODO no guarantee this won't get stuck in a loop.
                console.log('Not enough energy to renew :(');
                delete creep.memory.renew;
                return false;
            case ERR_BUSY:
                if(creep.ticksToLive > start) delete creep.memory.renew;
                return false;
            case OK:
                creep.memory.cost += renewCost(creep);
                break;
            default:
                console.log(`${creep.name} failed to renew: ${ret}`);
                break;
            }
            return true;
        }
    }
    return false;
},
flee: function(creep, minRange=4, swampCost=10) {
  // TODO: If the chaser(s) are less fast, then swamps are preferred. If
  // they're equal speed, finding paths that make them move through swamps
  // while we don't let us break away...

  // TODO: Split away from other fleeing friends so someone gets to survive.

  // TODO: try to flee in a target direction maybe?
  const baddies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, minRange+1, {
    filter: c => c.body.some(b => b.hits && SCARY_PARTS.includes(b.type))});
  if(!baddies.length) return ERR_NOT_IN_RANGE;
  const path = PathFinder.search(creep.pos, baddies.map(b => ({range: minRange, pos: b.pos})), {flee: true, maxCost: 100, swampCost});
  if(path.path.length) {
    return creep.move(creep.pos.getDirectionTo(path.path[0]));
  }
  return ERR_NO_PATH;
},
};

const SCARY_PARTS = [ATTACK, RANGED_ATTACK];
