import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Schedule } from "./Schedule";
import { ScheduleLogFile } from "./ScheduleLogFile";

export type JobStatus = "running" | "completed" | "failed" | "interrupted";
export type EngineType = "robocopy" | "xcopy" | "rclone";

@Entity("schedule_logs")
export class ScheduleLogs {

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Schedule)
  @JoinColumn({ name: "schedule_id" })
  schedule!: Schedule;

  @Column({
    type: "enum",
    enum: ["archive", "sync"],
  })
  type!: "archive" | "sync";

  @Column()
  source!: string;

  @Column()
  destination!: string;

  @Column({ type: "datetime" })
  startTime!: Date;

  @Column({ type: "datetime", nullable: true })
  endTime!: Date;

  @Column()
  totalFiles!: number;

  @Column("bigint")
  totalSize!: number;

  @Column({
    type: "enum",
    enum: ["running", "completed", "failed", "interrupted"],
    default: "running",
  })
  status!: JobStatus;

  @Column({
    type: "enum",
    enum: ["robocopy", "xcopy", "rclone"],
  })
  engine!: EngineType;

  @Column({ nullable: true })
  pid!: number;

  @Column({ default: 0 })
  attemptCount!: number;

  @Column({ type: "boolean", default: false })
  resumedFromCrash!: boolean;

  @OneToMany(() => ScheduleLogFile, (file) => file.log, {
    cascade: true,
  })
  files!: ScheduleLogFile[];
}