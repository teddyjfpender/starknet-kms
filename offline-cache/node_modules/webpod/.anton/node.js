/// <reference path="../dist/index.d.ts" />
import {ssh} from '../dist/index.js'

const $ = ssh('deployer@demo.deployer.org', {port: 22})
console.log(await $`echo ${"hello world!"} | less`)
