import chalk from 'chalk';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';
import { MongoDB } from 'winston-mongodb';
import * as Transport from 'winston-transport';

export function getWinstronLogger(
  maxFiles: string | number,
  datePattern: string,
  defaultContext: string,
  logLevel?: string,
  dbUrl?: string,
  dbCollectionSuffix?: string,
) {
  const transportsArr: Transport[] = [
    new transports.DailyRotateFile({
      filename: `logs/%DATE%-${dbCollectionSuffix}-error.log`,
      level: 'error',
      format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json()),
      datePattern: datePattern,
      zippedArchive: false,
      maxFiles,
    }),
    new transports.DailyRotateFile({
      level: logLevel,
      filename: `logs/%DATE%-${dbCollectionSuffix}-combined.log`,
      format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json()),
      datePattern: datePattern,
      zippedArchive: false,
      maxFiles,
    }),
    new transports.Console({
      format: format.combine(
        // format.cli(),
        // format.splat(),
        format.colorize({ all: true }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf((info) => {
          return `${chalk.green(`[Nest] ${process.pid}`)}\t${info.timestamp}\t${info.level} [${chalk.yellow(info.context || defaultContext)}] ${info.message}${info.level.match('error') ? '\n' + info.stack : ''}`;
        }),
      ),
    }),
  ];

  if (dbUrl?.length) {
    transportsArr.push(
      new MongoDB({
        level: logLevel,
        db: dbUrl,
        collection: `logs_combined_${dbCollectionSuffix}`,
        format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json()),
      }),
      new MongoDB({
        level: 'error',
        db: dbUrl,
        collection: `logs_error_${dbCollectionSuffix}`,
        format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json()),
      }),
    );
  }

  return WinstonModule.createLogger({
    transports: transportsArr,
  });
}
