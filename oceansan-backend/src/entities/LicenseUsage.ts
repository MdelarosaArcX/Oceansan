import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { License } from "./License";

@Entity("license_usage")
@Index(["license", "ip"], { unique: true })
export class LicenseUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => License, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "license_id" })
  license!: License;

  @Column()
  ip!: string;

  @CreateDateColumn()
  activatedAt!: Date;

  @Column({ type: "datetime", nullable: true })
  lastSeenAt!: Date | null;
}
