import config from '../config';
import { Models } from '../models/factory';
import { afterAllTests, beforeAllDb, beforeEachDb, expectThrow, models, msleep } from '../utils/testing/testUtils';
import { Env } from '../utils/types';
import TaskService, { RunType, Task } from './TaskService';

const newService = () => {
	return new TaskService(Env.Dev, models(), config(), {
		share: null,
		email: null,
		mustache: null,
		tasks: null,
		userDeletion: null,
	});
};

describe('TaskService', function() {

	beforeAll(async () => {
		await beforeAllDb('TaskService');
	});

	afterAll(async () => {
		await afterAllTests();
	});

	beforeEach(async () => {
		await beforeEachDb();
	});

	test('should register a task', async function() {
		const service = newService();

		const task: Task = {
			id: 123456,
			description: '',
			run: (_models: Models) => {},
			schedule: '',
		};

		service.registerTask(task);

		expect(service.tasks[123456]).toBeTruthy();
		await expectThrow(async () => service.registerTask(task));
	});

	test('should run a task', async function() {
		const service = newService();

		let finishTask = false;
		let taskHasRan = false;

		const taskId = 123456;

		const task: Task = {
			id: taskId,
			description: '',
			run: async (_models: Models) => {
				const iid = setInterval(() => {
					if (finishTask) {
						clearInterval(iid);
						taskHasRan = true;
					}
				}, 1);
			},
			schedule: '',
		};

		service.registerTask(task);

		expect(service.taskState(taskId).running).toBe(false);

		const startTime = new Date();

		void service.runTask(taskId, RunType.Manual);
		expect(service.taskState(taskId).running).toBe(true);

		while (!taskHasRan) {
			await msleep(1);
			finishTask = true;
		}

		expect(service.taskState(taskId).running).toBe(false);

		const events = await service.taskLastEvents(taskId);
		expect(events.taskStarted.created_time).toBeGreaterThanOrEqual(startTime.getTime());
		expect(events.taskCompleted.created_time).toBeGreaterThan(startTime.getTime());
	});

});
