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

  @Column({ default: true })
  encryptBackup!: boolean;

  @Column({ type: "text", nullable: true })
  nextcloudUrl!: string | null;

  @Column({ type: "text", nullable: true })
  nextcloudUsername!: string | null;

  @Column({ type: "text", nullable: true })
  nextcloudAppPassword!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
