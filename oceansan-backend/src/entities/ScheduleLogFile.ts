import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ScheduleLogs } from "./ScheduleLogs";

export type FileStatus = "copied" | "updated" | "deleted" | "error";

@Entity("schedule_log_files")
export class ScheduleLogFile {

  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  path!: string;

  @Column("bigint")
  size!: number;

  @Column({
    type: "text",
  })
  status!: FileStatus;

  @Column({ nullable: true })
  error!: string;

  @ManyToOne(() => ScheduleLogs, (log) => log.files, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "log_id" })
  log!: ScheduleLogs;
}
