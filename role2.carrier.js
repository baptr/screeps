const ROLE = 'carrier';

module.exports = {
ROLE: ROLE,
// TODO(baptr): Take a room instead of a single spawn?
spawn: function(spawn, opts) {
    if(!opts) opts = {};
    const room = spawn.room;
    // TODO(baptr): Extra move so they are ok in swamps?
    // TODO(baptr): Sort similarly when it becomes dynamic.
    var body = Array(15).fill(TOUGH).concat(Array(24).fill(MOVE)).concat(Array(10).fill(CARRY)).concat(Array(1).fill(MOVE));
    console.log(`Spawning ${ROLE} in ${room} with opts ${JSON.stringify(opts)}`);
    
    // TODO(baptr): Do this dedupe check at some higher level.
    var old = _.find(Game.creeps, c => c.memory.role == ROLE && c.memory.src == opts.src && c.memory.dest == opts.dest && c.memory.res == opts.res);
    if(old) {
        console.log("Preventing deuplicate carrier spawn:", old);
        return false;
    }
    
    return spawn.spawnCreep(body, `${ROLE}-${room.name}-${Game.time}`, {memory: {
        role: ROLE,
        src: opts.src,
        dest: opts.dest,
        res: opts.res,
        filling: true,
    }});
},
run: function(creep) {
    const src = Game.getObjectById(creep.memory.src);
    const dest = Game.getObjectById(creep.memory.dest);
    const res = creep.memory.res;
    if(!src || !dest || !res) {
        console.log(`${creep.name} missing required values src=${src} dest=${dest} res=${res}, goodbye.`);
        // TODO(baptr): Could be cases where the src is invalid after pickup, which shouldn't cause us to fall over.
        if(_.sum(creep.carry) > 0) {
            console.log(".. but I'm carrying", JSON.stringify(creep.carry));
        } else {
            creep.suicide();
        }
        return false;
    }
    if(creep.memory.filling) {
        if(!creep.pos.isNearTo(src.pos)) {
            creep.moveTo(src);
            return;
        }
        if(creep.ticksToLive < 350 && _.sum(creep.carry) == 0) {
            // Give up before picking up more if we're unlikely to deliver it in time.
            creep.suicide();
        }
        // withdraw does a relatively large number of checks before isNearTo.
        // probably better with the separate check first??
        var ret = creep.withdraw(src, res);
        switch(ret) {
        case OK:
        case ERR_FULL:
            creep.memory.filling = false;
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            if(_.sum(creep.carry) > 0) {
                creep.memory.filling = false;
            } else {
                console.log(creep.name,'has nothing left to withdraw');
                creep.suicide();
            }
            break;
        default:
            console.log(`${creep.name}: unexpected withdraw error: ${ret}`);
        }
    } else {
        if(!creep.pos.isNearTo(dest.pos)) {
            creep.moveTo(dest);
            return;
        }
        var ret = creep.transfer(dest, res);
        switch(ret) {
        case OK:
            // Try again next tick to figure out if we're empty or they're full.
            // Otherwise we could make the wrong decision about what to do next.
            break;
        case ERR_NOT_ENOUGH_RESOURCES:
            if(src.id == dest.id) {
                console.log(creep.name, 'has nothing left to do');
                creep.suicide();
                return;
            }
            creep.memory.filling = true;
            break;
        case ERR_FULL:
            console.log(`${creep.name}: dest is full. Returning remaining supply`);
            creep.memory.dest = src.id;
            break;
        }
    }
}
};