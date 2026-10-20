// Executes actual application SQL against a fresh in-memory database per test.
// Models D1 prepare/bind/first/all/run and atomic batch; not a Workers emulator.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

export function sqliteD1(...schemas) {
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const schema of schemas)sqlite.exec(readFileSync(new URL('../../'+schema,import.meta.url),'utf8'));
 const db={
  sqlite,
  close:()=>sqlite.close(),
  prepare(sql){
   let args=[];
   const statement={sql,
    bind(...values){args=values;return statement},
    async first(){return sqlite.prepare(sql).get(...args)??null},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
   };
   return statement;
  },
  async batch(statements){
   sqlite.exec('BEGIN');
   try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}
   catch(error){sqlite.exec('ROLLBACK');throw error}
  }
 };
 return db;
}
