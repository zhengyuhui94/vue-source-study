/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'
/*
  首先使用 originalSayHello 变量缓存原来的 sayHello 函数，
  然后重新定义 sayHello 函数，并在新定义的 sayHello 函数中调用缓存下来的 originalSayHello。
  这样我们就保证了在不改变 sayHello 函数行为的前提下对其进行了功能扩展
 Vue 正是通过这个技巧实现了对数据变异方法的拦截
  const originalSayHello = sayHello
  sayHello = function () {
    console.log('Hi')
    originalSayHello()
  }
*/
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * 拦截突变方法并发出事件
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    //  this 数组实例本身
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push': // 末尾添加
      case 'unshift': // 开头添加
        inserted = args
        break
      case 'splice': // 删除元素并在删除的地方添加元素
        inserted = args.slice(2)
        break
    }
    // inserted 变量中所保存的就是新增的数组元素，我们只需要调用 observeArray 函数对其进行观测即可
    if (inserted) ob.observeArray(inserted)
    // notify change
    // ob.dep(dep) 中收集了所有该对象(或数组)的依赖(观察者)
    ob.dep.notify()
    return result
  })
})
