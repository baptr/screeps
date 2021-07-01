module.exports.deliveryMath = deliveryMath;

function deliveryMath(room) {
  console.log(`Room ${room.name} delivery math:`);
  const srcs = room.find(FIND_SOURCES);
  _.forEach(srcs, src => {
    const rate = src.energyCapacity/ENERGY_REGEN_TIME;
    const harvestWork = Math.ceil(rate / HARVEST_POWER);
    const upgradeWork = Math.ceil(rate / UPGRADE_CONTROLLER_POWER);
    // TODO: There might be a better way to figure out which destination is
    // furthest from the source...
    const sinks = room.find(FIND_STRUCTURES, {filter: s => {
      // TODO: What happens if we get a hauler before we've built a container?
      // Does it need to drop the energy on the ground or transfer directly to
      // the workers?
      if(s.structureType == STRUCTURE_CONTROLLER) return true;
      if(!s.store) return false;
      if(s.store.getCapacity(RESOURCE_ENERGY) <= 0) return false;
      // Make sure it's not a container near a source.
      return s.pos.findInRange(srcs, 1).length == 0;
    }});
    let maxDist = 0;
    let maxSink = null;
    _.forEach(sinks, d => {
      // TODO could consider serializing these and actually using them for transport...
      const path = room.findPath(src.pos, d.pos, {ignoreCreeps: true, maxRooms: 1, range: 1});
      if(path.length > maxDist) {
        maxDist = path.length;
        maxSink = d;
      }
    });
    if(!maxDist) {
      console.log(`Unable to find any energy sink from src@${src.pos}`);
      return;
    }
    const carryNeed = Math.ceil(rate*maxDist*2 / CARRY_CAPACITY);
    console.log(` src@${src.pos} is ${maxDist} from ${maxSink.structureType}@${maxSink.pos}`);
    console.log(` - rate=${rate} harvestWork=${harvestWork} carryNeed=${carryNeed} upgradeWork=${upgradeWork}`);
  });
}
