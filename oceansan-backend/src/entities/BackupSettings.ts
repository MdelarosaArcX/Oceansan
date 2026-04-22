import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("backup_settings")
export class BackupSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: "" })
  documentsPath!: string;

  @Column({ default: true })
  includeSubfolders!: boolean;

  @Column({ default: "One-way backup" })
  syncMode!: string;

  @Column({ default: "Daily" })
  schedule!: string;

  @Column({ type: "text", default: "02:00" })
  syncTime!: string;

  @Column({ type: "integer", default: 1 })
  syncDayOfMonth!: number;

  @Column({ default: true })
  encryptBackup!: boolean;

  @Column({ type: "text", nullable: true })
  archivePassword!: string | null;

  @Column({ type: "text", nullable: true })
  nextcloudUrl!: string | null;

  @Column({ type: "text", nullable: true })
  nextcloudUsername!: string | null;

  @Column({ type: "text", nullable: true })
  nextcloudAppPassword!: string | null;

  @Column({ type: "text", nullable: true })
  cloudBaseUrl!: string | null;

  @Column({ type: "text", nullable: true })
  cloudAuthPath!: string | null;

  @Column({ type: "text", nullable: true })
  cloudUploadPath!: string | null;

  @Column({ type: "text", nullable: true })
  cloudRepository!: string | null;

  @Column({ type: "text", nullable: true })
  cloudUsername!: string | null;

  @Column({ type: "text", nullable: true })
  cloudPassword!: string | null;

  @Column({ type: "text", nullable: true })
  cloudAccessToken!: string | null;

  @Column({ type: "text", nullable: true })
  cloudSyncToken!: string | null;

  @Column({ type: "datetime", nullable: true })
  cloudSyncValidatedAt!: Date | null;

  @Column({ default: false })
  cloudSyncEnabled!: boolean;

  @Column({ type: "datetime", nullable: true })
  lastSyncAttemptAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  lastSuccessfulSyncAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
