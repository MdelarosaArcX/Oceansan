export interface CopyJob {
  id: string;
  name: string;
  from: string;
  to: string;
  cron: string;
  enabled: boolean;
  createdAt: string;
}
