/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历当前 Dep 实例对象的 subs 属性中所保存的所有观察者对象，
    // 逐个调用观察者对象的 update 方法，这就是触发响应的实现机制
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// 正在评估的当前目标监视程序。
// the current target watcher being evaluated.
// 这在全局上是唯一的，因为在任何时候都只能有一个观察者被评估。
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// Dep.target 中保存的值就是要被收集的依赖(观察者)
// 渲染函数执行之前 Dep.target 的值必然是 渲染函数的观察者对象
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target // Dep.target 保存着一个观察者对象，其实这个观察者对象就是即将要收集的目标
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
