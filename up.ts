import BG_Image_1 from "@/assets/images/myne_bg_photos/bg-photo-1.jpeg";
import BG_Image_2 from "@/assets/images/myne_bg_photos/bg-photo-2.jpeg";
import BG_Image_3 from "@/assets/images/myne_bg_photos/bg-photo-3.jpeg";
import useAuth from "@/hooks/useAuth";
import Text from "@/lib/Text";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Switch,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { captureRef } from "react-native-view-shot";
import tw from "twrnc";
import LoaderUI from "../ui/loader/LoaderUI";

const BACKGROUNDS = [
    { id: "1", source: BG_Image_1, textColor: "#000" },
    { id: "2", source: BG_Image_2, textColor: "#FFF" },
    { id: "3", source: BG_Image_3, textColor: "#000" },
];

// ─── Component ────────────────────────────────────────────────────────────────
const CustomizeStep: React.FC<{
    image: string;
    onContinue: (uri?: string) => void;
    setProcessedImage: (val: string) => void;
}> = ({ image, onContinue, setProcessedImage }) => {
    const { user } = useAuth();
    const [selectedImg, setSelectedImg] = useState(BACKGROUNDS[0]);
    const [showCollectionName, setShowCollectionName] = useState(true);
    const [collectionName, setCollectionName] = useState("");
    const captureViewRef = useRef<View>(null);
    const [isPressed, setIsPressed] = useState<boolean>(false);


    useEffect(() => {
        const nextName = user?.displayName || user?.name || "";
        setCollectionName((prev) => prev || nextName);
    }, [user?.displayName, user?.name]);

    const handleContinue = async () => {
        if (isPressed) return;
        try {
            const uri = await captureRef(captureViewRef, {
                format: "jpg",
                quality: 1,
            });

            setIsPressed(true);
            setProcessedImage(uri);
            onContinue(uri);
        } catch (error) {
            console.error("Continue failed from the customized step: ", error);
        } finally {
            setTimeout(() => {
                setIsPressed(false);
            }, 3000);
        }
    };

    if (isPressed) {
        return <LoaderUI />;
    }

    return (
        <ScrollView showsVerticalScrollIndicator= { false} style = { tw`flex-1 mt-4 h-full`
}>
    <View style={ tw`pb-6 overflow-hidden` }>
        <View
      ref={ captureViewRef }
collapsable = { false}
style = { [tw`w-full bg-transparent rounded-lg relative overflow-hidden`, { height: 600 }]}
    >
    {/* Background */ }
    < Image
source = { selectedImg?.source }
style = { [tw`absolute top-0 left-0 right-0 bottom-0 rounded-lg`, { width: "100%", height: "100%" }]}
contentFit = "cover"
    />

    {/* Shadow under bag */ }
    < View style = {{
    position: "absolute",
        bottom: "20%",
            alignSelf: "center",
                width: 200,
                    height: 20,
                        backgroundColor: "rgba(0,0,0,0.18)",
                            borderRadius: 999,
                                transform: [{ scaleX: 1.8 }],
}} />


{/* Product image container */ }
<View style={
    {
        position: "absolute",
            top: "15%",
                left: "10%",
                    right: "10%",
                        bottom: "22%",
                            justifyContent: "center",
                                alignItems: "center",
}
}>
    <Image
        source={ { uri: image } }
style = {{ width: "100%", height: "100%" }}
contentFit = "contain"
    />
    </View>

    < View style = {
    {
    position: "absolute",
        bottom: 0,
            left: 0,
                right: 0,
                    height: 120,
                        backgroundColor: "rgba(0,0,0,0.08)",
                            borderBottomLeftRadius: 12,
                                borderBottomRightRadius: 12,
}
} />

{/* Caption */ }
{
    showCollectionName && (
        <View style={ { position: "absolute", right: 28, bottom: 38, alignItems: "flex-end" } }>
            <Text style={ { fontFamily: "Libre-Bodoni-Regular", fontSize: 15, color: selectedImg?.textColor === "#FFF" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.50)" } }>
                Collection of
                    </Text>
                    < View style = {{ height: 0.5, backgroundColor: selectedImg?.textColor === "#FFF" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)", marginVertical: 4, width: "100%" }
} />
    < TextInput
value = { collectionName }
onChangeText = { setCollectionName }
placeholder = "Your name"
placeholderTextColor = { selectedImg?.textColor === "#FFF" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.30)"
}
style = {{ fontFamily: "Libre-Bodoni-Regular", fontSize: 22, marginTop: 2, textAlign: "right", letterSpacing: 0.5, color: selectedImg?.textColor === "#FFF" ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.58)", minWidth: 220 }}
          />
    </View>
      )}
</View>
    </View>



{/* ── Collection Title Toggle ────────────────────────────────────────── */ }
<View style={ tw`mb-6 rounded-xl bg-transparent px-4 py-3` }>
    <View style={ tw`flex-row items-center justify-between` }>
        <View style={ tw`flex-1 pr-4` }>
            <Text style={ [tw`text-white text-base font-semibold`, { fontFamily: "Libre-Bodoni-Regular" }] }>
                Show collection title
                    </Text>
                    < Text style = { [tw`text-white/70 text-sm mt-1`, { fontFamily: "Libre-Bodoni-Regular" }]} >
                        Toggle the collection name on the preview.
            </Text>
                            </View>
                            < Switch
value = { showCollectionName }
onValueChange = { setShowCollectionName }
    />
    </View>

{
    showCollectionName ? (
        <View
            style= { tw`mt-4 rounded-lg border border-white/15 bg-white/8 px-4 py-3`}
          >
    <View style={ tw`flex-row items-center mb-2` }>
        <Ionicons name="create-outline" size = { 16} color = "white" />
            <Text style={ [tw`text-white/80 text-sm ml-2`, { fontFamily: "Libre-Bodoni-Regular" }] }>
                Collection name
                    </Text>
                    </View>
                    < TextInput
value = { collectionName }
onChangeText = { setCollectionName }
placeholder = "Enter your display name"
placeholderTextColor = "#FFFFFF80"
style = {
    [
        tw`text-white text-lg`,
        { fontFamily: "Libre-Bodoni-Regular" },
              ]}
    />
    </View>
        ) : null}
</View>

{/* ── Background Suggestions ─────────────────────────────────────────── */ }
<View style={ tw`mb-8` }>
    <Text style={ [tw`text-white text-lg font-bold mb-4 ml-1`, { fontFamily: "Libre-Bodoni-Regular" }] }>
        Available Backgrounds
            </Text>
            < ScrollView
horizontal
showsHorizontalScrollIndicator = { false}
contentContainerStyle = { tw`px-1`}
        >
{
    BACKGROUNDS.map((bg) => (
        <TouchableOpacity
              key= { bg.id }
              onPress = {() => setSelectedImg(bg)}
style = { tw`mr-4 rounded-xl overflow-hidden border-[3px] w-24 h-24 justify-end ${selectedImg?.id === bg.id
    ? "border-primary"
    : "border-transparent"
    }`}
            >
    <Image
                source={ bg.source }
style = { tw`w-full h-full absolute`}
contentFit = "cover"
    />
    <View style={ tw`w-full bg-black/50 py-1 px-1` }>
        <Text
                  style={
    [
        { fontFamily: "Libre-Bodoni-Regular", color: "white" },
        tw`text-center text-xs`,
    ]
}
numberOfLines = { 2}
    >
    Collection
    </Text>
    </View>
    </TouchableOpacity>
          ))}
</ScrollView>
    </View>

{/* ── Continue Button ────────────────────────────────────────────────── */ }
<View style={ tw`mb-24` }>
    <TouchableOpacity
          onPress={ handleContinue }
disabled = { isPressed }
style = { tw`bg-white rounded-lg py-4 flex-row items-center justify-center gap-2`}
        >
    {
        isPressed?(
            <ActivityIndicator color = { "black"} size = { "small"} />
          ): (
                <>
              <FontAwesome name = "photo" size = { 20 } color = "black" />
    <Text style={ [tw`text-black text-base font-semibold`, { fontFamily: "Libre-Bodoni-Regular" }] }>
        Continue
        </Text>
        </>
          )}
</TouchableOpacity>
    </View>
    </ScrollView>
  );
};

export default CustomizeStep;