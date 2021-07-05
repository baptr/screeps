const creepUtil = require('util.creep');

module.exports = {
check: function(room) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if(!hostiles.length) return false;

  // TODO: diminish danger by travel time necessary to demonstrate it?
  // TODO: and ticks of life left.
  let danger = 0;
  for(const c of hostiles) {
    bodyPower(c, CLAIM, CONTROLLER_CLAIM_DOWNGRADE);
  }
},
}
