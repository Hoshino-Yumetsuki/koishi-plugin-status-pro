/*
 * @Author: Kabuda-czh
 * @Date: 2023-02-16 09:35:30
 * @LastEditors: Kabuda-czh
 * @LastEditTime: 2023-02-16 18:28:27
 * @FilePath: \koishi-plugin-status-pro\src\neko\utils\index.ts
 * @Description:
 *
 * Copyright (c) 2023 by Kabuda-czh, All Rights Reserved.
 */
import os from "os";
import * as si from "systeminformation";

const ErrorInfo = "N / A";

export async function getSystemInfo(
  name: string,
  koishiVersion: string,
  pluginSize: number
) {
  const promisList = await Promise.all([
    getCPUUsage(),
    si.osInfo(),
    si.cpuCurrentSpeed(),
    si.mem(),
    getDiskUsage(),
  ]);

  const { uptime } = si.time();

  const [
    { cpuUsage, cpuInfo },
    { distro },
    { avg },
    { total, used, swaptotal, swapused },
    { disksize, diskused },
  ] = promisList;

  // memory
  const memoryTotal = (total / 1024 / 1024 / 1024).toFixed(2) + " GB";
  const memoryUsed = (used / 1024 / 1024 / 1024).toFixed(2);
  const memoryUsage = (used / total).toFixed(2);
  // swap
  const swapTotal = (swaptotal / 1024 / 1024 / 1024).toFixed(2) + " GB";
  const swapUsed = (swapused / 1024 / 1024 / 1024).toFixed(2);
  const swapUsage = (swapused / swaptotal).toFixed(2);
  // disk
  const diskTotal = (disksize / 1024 / 1024 / 1024).toFixed(2) + " GB";
  const diskUsed = (diskused / 1024 / 1024 / 1024).toFixed(2);
  const diskUsage = (diskused / disksize).toFixed(2);

  const systemInfo = {
    name,
    dashboard: [
      {
        progress: +cpuUsage,
        title: `${(+cpuUsage * 100).toFixed(0)}% - ${avg}Ghz`,
      },
      {
        progress: +memoryUsage || 0,
        title: isNaN(+memoryUsed) ? ErrorInfo : `${memoryUsed} / ${memoryTotal}`,
      },
      {
        progress: +swapUsage || 0,
        title: isNaN(+swapUsed) ? ErrorInfo : `${swapUsed} / ${swapTotal}`,
      },
      {
        progress: +diskUsage || 0,
        title: isNaN(+diskUsed) ? ErrorInfo : `${diskUsed} / ${diskTotal}`,
      },
    ],
    information: [
      {
        key: "CPU",
        value: cpuInfo,
      },
      {
        key: "System",
        value: distro,
      },
      {
        key: "Version",
        value: koishiVersion,
      },
      {
        key: "Plugins",
        value: `${pluginSize} loaded`,
      },
    ],
    footer: durationTime(uptime),
  };

  return systemInfo;
}

async function getDiskUsage() {
  const disks = await si.fsSize();
  let disksize = 0,
    diskused = 0;
  disks.forEach((disk) => {
    disksize += disk.size;
    diskused += disk.used;
  });

  return {
    disksize,
    diskused,
  };
}

async function getCPUUsage() {
  const t1 = getCPUInfo();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const t2 = getCPUInfo();

  const idle = t2.idle - t1.idle;
  const total = t2.total - t1.total;

  const cpuUsage = (1 - idle / total).toFixed(2);
  const cpuInfo = os.cpus()[0].model;

  return {
    cpuUsage,
    cpuInfo,
  };
}

function getCPUInfo() {
  const cpus = os.cpus();
  let idle = 0;

  const total = cpus.reduce((acc, cpu) => {
    for (const type in cpu.times) {
      acc += cpu.times[type];
    }
    idle += cpu.times.idle;
    return acc;
  }, 0);

  return {
    idle,
    total,
  };
}

function durationTime(time: number) {
  const day = Math.floor(time / 86400);
  const hour = Math.floor((time - day * 86400) / 3600);
  const minute = Math.floor((time - day * 86400 - hour * 3600) / 60);

  return `已持续运行 ${day}天 ${hour}小时 ${minute}分钟`;
}
