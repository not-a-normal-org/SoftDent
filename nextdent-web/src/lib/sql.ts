import "server-only";
import { Prisma } from "@prisma/client";

/**
 * A JS Date as a value that compares correctly with a Prisma DateTime column in raw SQL.
 *
 * Prisma stores a DateTime as `timestamp without time zone` holding UTC, but binds a
 * Date passed to $queryRaw as `timestamptz`. Postgres compares the two by reading the
 * column in the *session's* timezone, which is Asia/Dhaka on the clinic's local server
 * and usually UTC on a hosted one. So a bare `${date}` shifts every comparison by
 * that offset: six hours on one machine, none on the next. On the local database a
 * day's missed appointments came back as the next day's. Turning the parameter into
 * naive UTC compares like with like on any server. Prisma's own query builder (where:
 * { gte: date }) already does this; only raw SQL needs it.
 */
export const sqlInstant = (d: Date) => Prisma.sql`(${d}::timestamptz AT TIME ZONE 'UTC')`;
