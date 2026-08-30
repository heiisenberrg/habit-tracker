#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (WidgetBridge, NSObject)

RCT_EXTERN_METHOD(setSharedState : (NSString *)json forceReload : (BOOL)force)

@end
