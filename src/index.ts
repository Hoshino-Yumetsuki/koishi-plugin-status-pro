import { Context, Logger, Schema, segment, version } from 'koishi';
import { getSystemInfo } from './neko/utils';
import { renderStatusImage } from './renderer/image';

export const name = 'status-pro';

export interface Config {
  botName?: string;
  command?: string;
  authority?: number;
}

export const Config: Schema<Config> = Schema.object({
  botName: Schema.string().default('koishi').description('机器人名称(默认: koishi)'),
  command: Schema.string().default('status-pro').description('自检指令自定义(默认: status-pro)'),
  authority: Schema.number().default(1).description('自检指令使用权限(默认: 1)')
});

export const logger = new Logger('status-pro');

export function apply(ctx: Context, config: Config) {
  ctx
    .command(config.command || 'status-pro', { authority: config.authority || 1 })
    .action(async () => {
      const systemInfo = await getSystemInfo(
        config.botName || 'koishi',
        version,
        ctx.registry.size
      );

      try {
        return segment.image(await renderStatusImage(systemInfo), 'image/png');
      } catch (e) {
        logger.error('状态渲染失败: ', e);
        return `渲染失败${e instanceof Error ? e.message : String(e)}`;
      }
    });
}
