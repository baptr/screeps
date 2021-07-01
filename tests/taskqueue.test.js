const tasks = require('../sys.taskQueue');

test('bodyPower', () => {
  const body = [{hits: 100, type: MOVE}, {hits: 100, type: CARRY}, {hits: 100, type: WORK}];
  expect(tasks.bodyPower(body)).toStrictEqual({
    hits: 300,
    capacity: 50,
    movePower: 0.5,
    harvest: 2,
    build: 5,
    repair: 100,
    dismantle: 50,
    upgradeController: 1,
  });
});

test('bodyPower boosted', () => {
  const body = [{type: TOUGH, hits: 50, boost: "GHO2"},
                {type: CARRY, hits: 100, boost: "KH"},
                {type: WORK, hits: 100, boost: "LH"},
                {type: WORK, hits: 100, boost: "UO"},
                {type: MOVE, hits: 100, boost: "ZO"},
                {type: MOVE, hits: 100, boost: "ZO"}];
  expect(tasks.bodyPower(body)).toStrictEqual({
    hits: 600,
    capacity: 100,
    movePower: 1,
    harvest: 8,
    build: 12.5,
    repair: 250,
    dismantle: 100,
    upgradeController: 2,
  });
});

test('taskScore', () => {
  const creep = {
    body: [{type: MOVE}, {type: MOVE}, {type: MOVE},
           {type: CARRY}, {type: CARRY}, {type: CARRY}],
  };
  expect(tasks.bodyPower(creep.body)).toHaveProperty('capacity', 150);
  expect(tasks.bodyPower(creep.body)).toHaveProperty('movePower', 1);

  const harvest = new tasks.Task(tasks.HARVEST, new RoomPosition(25,25), 100);
  expect(harvest.need()).toStrictEqual({harvest: 100});
  expect(tasks.taskScore(creep, harvest)).toBe(0);

  const carry = new tasks.Task(tasks.CARRY, new RoomPosition(25,25), 100);
  expect(carry.need()).toStrictEqual({capacity: 100, movePower: 1});
  expect(tasks.taskScore(creep, carry)).toBe(1.5);
});

test('taskScore ranking', () => {
  const basicWorker = {
    body: bodyHelper([WORK, MOVE, CARRY, MOVE]),
  };
  const slowWorker = {
    body: bodyHelper([WORK, CARRY, MOVE]),
  };
  const highCap = {
    body: bodyHelper([WORK, CARRY, CARRY, CARRY,
                      MOVE, MOVE, MOVE, MOVE]),
  };
  const highWork = {
    body: bodyHelper([WORK, WORK, WORK, CARRY,
                      MOVE, MOVE, MOVE, MOVE]),
  };
  const build = new tasks.Task(tasks.BUILD, new RoomPosition(25,25), 3000);
  // 5*150 vs 15*50
  expect(tasks.taskScore(highCap, build)).toBeGreaterThan(tasks.taskScore(highWork, build));

  const candidates = [basicWorker, slowWorker, highCap, highWork];
  const sorted = _.sortBy(candidates, [c => tasks.taskScore(c, build)]);
  expect(sorted).toEqual([slowWorker, basicWorker, highWork, highCap]);
});

function bodyHelper(types) {
  return _.map(types, t => ({type: t, hits: 100}));
}
