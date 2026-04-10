import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
} from "@op-engineering/op-test";
import { type DB, open } from "@op-engineering/op-sqlite";

describe("executeBatch concurrency", () => {
	let db: DB;

	beforeEach(async () => {
		db = open({ name: "concurrency.sqlite" });
		await db.execute("DROP TABLE IF EXISTS Items;");
		await db.execute(
			"CREATE TABLE Items (id INTEGER PRIMARY KEY, value TEXT NOT NULL) STRICT;",
		);
	});

	afterEach(() => {
		if (db) {
			db.delete();
		}
	});

	it("roll back the entire batch on failure", async () => {
		await db.execute("INSERT INTO Items VALUES (1, 'before');");

		let caughtError: Error | null = null;
		try {
			await db.executeBatch([
				["INSERT INTO Items VALUES (2, 'new');"],
				["INSERT INTO Items VALUES (1, 'duplicate');"], // violates PK — fails
				["INSERT INTO Items VALUES (3, 'after-fail');"],
			]);
		} catch (e: any) {
			caughtError = e;
		}

		expect(caughtError !== null).toEqual(true);

		const result = await db.execute("SELECT * FROM Items ORDER BY id;");
		// The entire failing batch must be rolled back — only the pre-existing row survives
		expect(result.rows.length).toEqual(1);
		expect(result.rows[0]!["id"]).toEqual(1);
		expect(result.rows[0]!["value"]).toEqual("before");
	});
});
