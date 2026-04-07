import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type BackupRunStatus = "queued" | "running" | "completed" | "failed";

@Entity("backup_runs")
export class BackupRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  status!: BackupRunStatus;

  @Column({ type: "datetime", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  completedAt!: Date | null;

  @Column({ type: "text", nullable: true })
  message!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
