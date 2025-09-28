'use client'

import React, { createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { Marker } from '@/types/marker'
import { MapMarker } from '@/components/map/common/map-marker'

export class GoogleMarkerOverlay {
    private div: HTMLDivElement
    private root: Root
    private marker: Marker
    private onClick: () => void
    private isSelected: boolean
    private zoom: number
    private position: any
    private clickHandler: (e: Event) => void
    private overlayView: any
    private isDestroyed: boolean = false
    private map: any
    private zoomListener: any

    constructor(
        marker: Marker,
        onClick: () => void,
        isSelected: boolean = false,
        zoom: number = 11
    ) {
        this.marker = marker
        this.onClick = onClick
        this.isSelected = isSelected
        this.zoom = zoom
        this.position = new (window as any).google.maps.LatLng(
            marker.coordinates.latitude,
            marker.coordinates.longitude
        )

        // 创建点击处理函数
        this.clickHandler = (e: Event) => {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            this.onClick()
        }

        // 创建容器div
        this.div = document.createElement('div')
        this.div.style.position = 'absolute'
        this.div.style.transform = 'translate(-50%, -50%)'
        this.div.style.transformOrigin = 'center center'
        this.div.style.cursor = 'pointer'
        this.div.style.zIndex = '1000' // 提高z-index确保在最上层
        this.div.style.pointerEvents = 'auto' // 确保可以接收鼠标事件
        this.div.style.width = '28px' // 设置固定尺寸
        this.div.style.height = '28px'
        this.div.style.boxSizing = 'border-box' // 确保边框不影响尺寸计算
        
        // 添加点击事件监听器
        this.div.addEventListener('click', this.clickHandler, true)
        this.div.addEventListener('mousedown', this.clickHandler, true)

        // 创建React root
        this.root = createRoot(this.div)
        
        // 渲染React组件
        this.render()
    }

    private render() {
        if (this.isDestroyed || !this.root) return
        
        try {
            this.root.render(
                createElement(MapMarker, {
                    marker: this.marker,
                    isSelected: this.isSelected,
                    onClick: this.onClick,
                    zoom: this.zoom
                })
            )
        } catch (error) {
            console.warn('Error rendering marker overlay:', error)
        }
    }

    // 设置地图
    setMap(map: any) {
        if (this.isDestroyed) return
        
        if (map) {
            this.map = map
            
            // 动态继承OverlayView
            if (!this.overlayView) {
                this.overlayView = new (window as any).google.maps.OverlayView()
                
                // 实现OverlayView的方法
                this.overlayView.onAdd = () => {
                    if (!this.overlayView) return
                    
                    const panes = this.overlayView.getPanes()
                    if (panes) {
                        // 添加到overlayMouseTarget层，这个层专门用于接收鼠标事件
                        panes.overlayMouseTarget.appendChild(this.div)
                    }
                }
                
                this.overlayView.draw = () => {
                    if (!this.overlayView) return
                    
                    const overlayProjection = this.overlayView.getProjection()
                    if (overlayProjection) {
                        const pixelPosition = overlayProjection.fromLatLngToDivPixel(this.position)
                        if (pixelPosition) {
                            this.div.style.left = pixelPosition.x + 'px'
                            this.div.style.top = pixelPosition.y + 'px'
                        }
                    }
                }
                
                this.overlayView.onRemove = () => {
                    if (!this.overlayView) return
                    
                    if (this.div.parentNode) {
                        this.div.parentNode.removeChild(this.div)
                    }
                    // 清理事件监听器
                    this.div.removeEventListener('click', this.clickHandler, true)
                    this.div.removeEventListener('mousedown', this.clickHandler, true)
                }
            }
            
            // 设置到地图
            this.overlayView.setMap(map)
            
            // 添加缩放级别监听器
            this.addZoomListener()
        } else {
            // 从地图移除
            if (this.overlayView) {
                this.overlayView.setMap(null)
            }
            // 清理缩放监听器
            this.removeZoomListener()
            this.map = null
        }
    }


    // 更新marker状态
    updateMarker(marker: Marker, isSelected: boolean, zoom: number) {
        if (this.isDestroyed) return
        
        const zoomChanged = this.zoom !== zoom
        const selectionChanged = this.isSelected !== isSelected
        const markerChanged = this.marker.id !== marker.id
        
        this.marker = marker
        this.isSelected = isSelected
        this.zoom = zoom
        
        // 只有在必要时才更新位置
        if (markerChanged) {
            this.position = new (window as any).google.maps.LatLng(
                marker.coordinates.latitude,
                marker.coordinates.longitude
            )
        }
        
        // 只有在选择状态或缩放级别改变时才重新渲染
        if (selectionChanged || zoomChanged) {
            this.render()
        }
    }
    

    // 更新点击处理函数
    updateOnClick(onClick: () => void) {
        if (this.isDestroyed) return
        
        this.onClick = onClick
        this.render()
    }

    // 添加缩放级别监听器
    private addZoomListener() {
        if (this.isDestroyed || !this.map) return
        
        this.removeZoomListener() // 先移除现有的监听器
        
        this.zoomListener = (window as any).google.maps.event.addListener(
            this.map, 
            'zoom_changed', 
            () => {
                if (this.isDestroyed || !this.map) return
                
                const currentZoom = this.map.getZoom()
                if (currentZoom !== this.zoom) {
                    this.zoom = currentZoom
                    this.render()
                }
            }
        )
    }

    // 移除缩放级别监听器
    private removeZoomListener() {
        if (this.zoomListener) {
            (window as any).google.maps.event.removeListener(this.zoomListener)
            this.zoomListener = null
        }
    }

    // 销毁
    destroy() {
        if (this.isDestroyed) return
        
        this.isDestroyed = true
        
        // 清理缩放监听器
        this.removeZoomListener()
        
        // 使用异步卸载避免React渲染时的竞态条件
        if (this.root) {
            // 使用 setTimeout 确保在下一个事件循环中卸载
            setTimeout(() => {
                try {
                    this.root.unmount()
                } catch (error) {
                    console.warn('Error unmounting React root:', error)
                }
            }, 0)
        }
        
        this.setMap(null)
        this.overlayView = null
        this.map = null
    }
}
