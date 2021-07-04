module.exports = {
move: function(creep, dest) {
  // XXX make sure to stay to roads as much as possible:
  // - ignore friendly creeps
  // - reuse paths for a long time.
  //   - could probably even path find the whole road once and use it for everything
  // - stay spaced at least 1 apart for passing
  // - pull/don't block the road if you stop to work
  return creep.moveTo(dest);
}
};
