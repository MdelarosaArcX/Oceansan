import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type ScheduleType = "sync" | "archive";
export type EngineType = "xcopy" | "robocopy" | "rclone";

@Entity("schedules")
export class Schedule {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sched_name!: string;

  @Column()
  src_path!: string;

  @Column()
  dest_path!: string;

  @Column({ nullable: true })
  recycle_path!: string;

  @Column({
    type: "enum",
    enum: ["sync", "archive"],
  })
  type!: ScheduleType;

  @Column({
    type: "enum",
    enum: ["xcopy", "robocopy", "rclone"],
  })
  engine!: EngineType;

  @Column()
  time!: string; // HH:mm

  @Column({
    type: "json",
  })
  days: number[];

  @Column({ default: true })
  active!: boolean;

  @Column({ default: true })
  recycle!: boolean;

  @Column({ type: "datetime", nullable: true })
  last_archived!: Date;

  @Column({ type: "datetime", nullable: true })
  last_sync!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}