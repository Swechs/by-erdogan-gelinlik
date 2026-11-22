import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const docs=sqliteTable('docs',{id:text('id').primaryKey(),data:text('data').notNull()});
export const slots=sqliteTable('slots',{start:text('start').primaryKey(),enabled:integer('enabled').notNull()});
export const bookings=sqliteTable('bookings',{id:text('id').primaryKey(),lookup:text('lookup').unique().notNull(),start:text('start').notNull().references(()=>slots.start),model:text('model').notNull(),name:text('name').notNull(),phone:text('phone').notNull(),wedding:text('wedding').notNull(),status:text('status').notNull(),notify:integer('notify').notNull(),delivery:text('delivery').notNull()},t=>[uniqueIndex('one_booking').on(t.start).where(sql`status IN ('pending','confirmed')`)]);
export const jobs=sqliteTable('jobs',{key:text('key').primaryKey(),remote:text('remote').notNull(),model:text('model').notNull(),state:text('state').notNull(),image:text('image'),expires:integer('expires').notNull()});
export const counts=sqliteTable('counts',{day:text('day').primaryKey(),tries:integer('tries').notNull()});
export const limits=sqliteTable('limits',{id:text('id').primaryKey(),used:integer('used').notNull(),expires:integer('expires').notNull()});
