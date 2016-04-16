import forIn from 'chirashi/src/core/for-in'
import forEach from 'chirashi/src/core/for-each'
import getElements from 'chirashi/src/core/get-elements'

import data from 'chirashi/src/dom/data'
import createElement from 'chirashi/src/dom/create-element'
import prop from 'chirashi/src/dom/prop'
import addClass from 'chirashi/src/dom/add-class'
import hasClass from 'chirashi/src/dom/has-class'
import removeClass from 'chirashi/src/dom/remove-class'
import insertBefore from 'chirashi/src/dom/insert-before'
import append from 'chirashi/src/dom/append'
import parent from 'chirashi/src/dom/parent'
import closest from 'chirashi/src/dom/closest'
import find from 'chirashi/src/dom/find'
import findOne from 'chirashi/src/dom/find-one'
import indexInParent from 'chirashi/src/dom/index-in-parent'
import remove from 'chirashi/src/dom/remove'

import screenPosition from 'chirashi/src/styles/screen-position'
import height from 'chirashi/src/styles/height'

import on from 'chirashi/src/events/on'
import off from 'chirashi/src/events/off'

import defaultify from 'chirashi/src/utils/defaultify'
import deepClone from 'chirashi/src/utils/deep-clone'

const defaults = {
    customID:    '',    // String   - Custom id
    customClass: '',    // String   - Custom Class
    placeholder: '',    // String   - Value if non empty string, else first
    loop:        false, // Boolean  - Should keyboard navigation loop ?
    size:        0,     // Integer  - If not 0, number of displayed items
    onChange:    null   // Function - Callback after change
}

function kebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
}

export default class CustomSelect {
    constructor (elements, options = {}) {

        this.elements = getElements(elements)

        this.options = defaultify(options, defaults)

        this.optionClick = this.optionClick.bind(this)
        this.optionHover = this.optionHover.bind(this)
        this.getFocus    = this.getFocus.bind(this)
        this.blurFocus   = this.blurFocus.bind(this)
        this.toggleFocus = this.toggleFocus.bind(this)
        this.tryToBlur   = this.tryToBlur.bind(this)

        forEach(this.elements, this.replaceDOMelement.bind(this))
    }

    replaceDOMelement (element) {
        let scopeSettings = deepClone(this.options)

        forIn(this.options, (key, value) => {
            let dataOption = data(element, kebabCase(key))

            if (dataOption != null)
            scopeSettings[key] = dataOption
        })

        let options = element.children

        if (!scopeSettings.placeholder) {
            let first = options[0]

            if (first.tagName === 'OPTGROUP')
            first = first.children[0]

            scopeSettings.placeholder = first.textContent
        }

        let select = createElement('div')
        if(scopeSettings.customID) prop(select, { id: scopeSettings.customID })

        addClass(select, 'cs-select')

        if(scopeSettings.customClass)
        addClass(select, scopeSettings.customClass)

        if (element.disabled)
        addClass(select, 'disabled')

        insertBefore(element, select)

        let wrapper = createElement('div')
        addClass(wrapper, 'cs-wrapper')
        append(select, wrapper)

        let list = createElement('ul')
        addClass(list, 'cs-list')
        append(wrapper, list)

        this.populateList(list, options)

        let label = createElement('div')
        addClass(label, 'cs-label')
        let labelTxt = createElement('span')
        let selected = findOne(list, '.selected')
        labelTxt.textContent = selected ? selected.textContent : scopeSettings.placeholder
        append(label, labelTxt)
        append(select, label)

        append(select, element)

        on(select, 'click', this.toggleFocus)

        this.checkViewport(select)
    }

    getFocus(event) {
        this.triggerSelect(event, event.currentTarget)
    }

    toggleFocus(event) {
        if (!hasClass(event.currentTarget, 'open'))
            this.getFocus(event)
        else
            this.blurFocus(event)
    }

    update() {
        forEach(this.elements, (elem) => {
            this.destroy(elem)

            let wrapper = parent(elem)
            insertBefore(wrapper, elem)
            remove(wrapper)

            this.replaceDOMelement(elem)
        })
    }

    populateList (list, options) {
        forEach(options, (item) => {
            let option = createElement('li')
            addClass(option, 'cs-option')

            if (item.tagName === 'OPTION') {
                data(option, { value: item.value })
                option.textContent = item.textContent

                if (item.disabled)
                    addClass(option, 'disabled')

                if (item.selected)
                    addClass(option, 'selected')

                append(list, option)
            }
            else {
                addClass(option, 'cs-optgroup')
                option.textContent = item.textContent

                append(list, option)

                let optgroup = createElement('ul')
                addClass(optgroup, 'cs-optgroup-list')

                append(option, optgroup)

                this.populateList(optgroup, item.children)
            }

            on(option, 'click', this.optionClick)
            on(option, 'mousemove', this.optionHover)
        }, true) // force order
    }

    destroy(elem) {
        if (!elem) { // destroy all
            elem = this.elements

            off(document.documentElement, 'click', this.blurFocus)
        }
        else
            this.elements.splice(this.elements.indexOf(elem), 1)

        forEach(elem, (select) => {
            off(select, 'click', this.getFocus)

            forEach(find(select, 'li.cs-option'), (options) => {
                off(option, 'click', this.optionClick)
                off(option, 'mousemove', this.optionHover)
            })
        })
    }

    blurFocus(event) {
        this.blurSelect(event, event.currentTarget)
    }

    blurSelect(event, select) {
        event.preventDefault()

        if(hasClass(select, 'open')) {
            removeClass(select, 'open')

            off(document.body, 'click', this.tryToBlur)
        }
    }

    triggerSelect(event, select){
        event.preventDefault()

        if(!hasClass(select, 'disabled')) {
            this.checkViewport(select)
            addClass(select, 'open')

            setTimeout(() => {
                on(document.body, 'click', this.tryToBlur)
            })
        }
    }

    tryToBlur(event) {
        forEach(this.elements, (realSelect) => {
            let select = parent(realSelect)
            let bounds = screenPosition(select)

            if (event.clientX < bounds.left
                || event.clientX > bounds.right
                || event.clientY < bounds.bottom
                || event.clientY > bounds.top)
                this.blurSelect(event, select)
        })
    }

    optionHover(event){
        let option = event.currentTarget
        let list = parent(option)
        let options = find(list, 'li.cs-option')

        if(!hasClass(option, 'disabled') || hasClass(option, 'cs-optgroup')){
            removeClass(options, 'active')
            addClass(option, 'active')
        }
    }

    optionClick(event){
        event.stopPropagation()

        let option = event.currentTarget
        let select = closest(option, '.cs-select')
        let options = find(select, 'li.cs-option')
        let index = indexInParent(option)

        if(!hasClass(option, 'disabled') || hasClass(option, 'cs-optgroup')) {

            removeClass(findOne(select, '.cs-option.selected'), 'selected')
            addClass(option, 'selected')

            let realSelect = findOne(select, 'select')
            let realOptions = find(realSelect, 'option')

            forEach(realOptions, (realOption) => realOption.selected = false)
            realOptions[index].selected = true

            findOne(select, '.cs-label').textContent = option.textContent

            var event = document.createEvent('HTMLEvents')
            event.initEvent('change', true, false)
            realSelect.dispatchEvent(event)
        }

        removeClass(select, 'open')
    }

    checkViewport(select){
        let screenPos = screenPosition(select),
        listHeight = height(findOne(select, '.cs-list'))

        if ((screenPos.bottom + listHeight + 10) > window.innerHeight && (screenPos.top - listHeight) > 10)
        addClass(select, 'above')
        else
        removeClass(select, 'above')
    }
}
