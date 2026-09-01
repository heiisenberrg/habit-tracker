#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (ScreenTimeReport, NSObject)

RCT_EXTERN_METHOD(getState : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(present : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
